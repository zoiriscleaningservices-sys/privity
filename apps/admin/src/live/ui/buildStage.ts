/**
 * Builds the stage tiles for a screen from authoritative room state (who is on stage),
 * presentation choices (order / featured / layout — host-local, see stagePresentation.ts)
 * and media presence (Stage 4: LiveKit; Lab: loopback).
 */

import type { ReactNode } from 'react';
import type { LiveRoomState } from '../core/roomState';
import type { UserRef } from '../core/events';
import type { ParticipantMedia } from '../client/connection';
import { computeStageLayout, ResolvedLayout, StageLayoutMode } from '../stage/stageLayout';
import type { TileModel } from './VideoStage';

export interface SelfMedia {
  id: string;
  local: ReactNode;
  cameraOn: boolean;
  micOn: boolean;
}

export interface BuildStageInput {
  room: LiveRoomState;
  /** Battle in progress: both sides share the stage (A left, B right — same as the score bar). */
  battle: { a: UserRef; b: UserRef } | null;
  mode: StageLayoutMode;
  /** Guest ids in presentation order (defaults to server slot order). */
  order?: ReadonlyArray<string>;
  featuredId?: string | null;
  presence: ReadonlyMap<string, ParticipantMedia>;
  self?: SelfMedia | null;
  localPlaybackMuted?: ReadonlySet<string>;
  onSelect?: (userId: string) => void;
  maxGrid?: number;
  maxStrip?: number;
}

export interface BuiltStage {
  layout: ResolvedLayout | 'battle';
  columns: number;
  tiles: TileModel[];
  overflow: number;
}

/** The battle owns the stage from acceptance until its result is cleared (server status). */
export function battleSides(room: LiveRoomState): { a: UserRef; b: UserRef } | null {
  const b = room.battle;
  if (!b) return null;
  if (b.status === 'accepted' || b.status === 'live' || b.status === 'locked' || b.status === 'finalized') {
    return { a: b.side_a.host, b: b.side_b.host };
  }
  return null;
}

export function buildStage(input: BuildStageInput): BuiltStage {
  const { room, presence, self } = input;
  const guestsById = new Map(room.guests.map((g) => [g.id, g]));
  const slotOrder = room.guests.map((g) => g.id);
  const order = (input.order ? input.order.filter((id) => guestsById.has(id)) : [...slotOrder]) as string[];
  for (const id of slotOrder) if (!order.includes(id)) order.push(id);

  const tileFor = (id: string, role: TileModel['role'], area: TileModel['area'], user: UserRef): TileModel => {
    const isSelf = self?.id === id;
    return {
      id,
      role: isSelf && role === 'guest' ? 'self' : role,
      area,
      user,
      local: isSelf ? self?.local : undefined,
      localCameraOn: isSelf ? self?.cameraOn : undefined,
      localMicOn: isSelf ? self?.micOn : undefined,
      media: isSelf ? undefined : presence.get(id) ?? null,
      featured: input.featuredId === id,
      localPlaybackMuted: input.localPlaybackMuted?.has(id),
      caption: isSelf ? (role === 'host' ? undefined : 'You') : undefined,
      onSelect: input.onSelect && role === 'guest' && !isSelf ? () => input.onSelect?.(id) : undefined,
    };
  };

  if (input.battle) {
    const maxStrip = input.maxStrip ?? 4;
    const strip = order.slice(0, maxStrip);
    const sideTile = (u: UserRef, side: 'a' | 'b'): TileModel => ({
      ...tileFor(u.id, u.id === room.host.id ? 'host' : 'opponent', 'half', u),
      side,
    });
    return {
      layout: 'battle',
      columns: 2,
      tiles: [
        sideTile(input.battle.a, 'a'),
        sideTile(input.battle.b, 'b'),
        ...strip.map((id) => tileFor(id, 'guest', 'strip', guestsById.get(id) as UserRef)),
      ],
      overflow: order.length - strip.length,
    };
  }

  const layout = computeStageLayout({
    hostId: room.host.id,
    guestIds: order,
    mode: input.mode,
    featuredId: input.featuredId ?? null,
    maxGrid: input.maxGrid,
    maxStrip: input.maxStrip,
  });
  return {
    layout: layout.layout,
    columns: layout.columns,
    tiles: layout.tiles.map((t) =>
      t.role === 'host' ? tileFor(t.id, 'host', t.area, room.host) : tileFor(t.id, 'guest', t.area, guestsById.get(t.id) as UserRef),
    ),
    overflow: layout.overflow.length,
  };
}
