/**
 * One renderer for every moment key, so a moment re-routed to another lane by the
 * server-published show config still renders correctly (never an empty lane slot).
 * Presentation only: payloads are server facts passed through the engine.
 */

import React from 'react';
import { Crown, Flag, Hourglass, LogIn, LogOut, ShieldAlert, TimerOff, UserPlus, Users, Zap } from 'lucide-react';
import { AnyMoment, MomentPayloads } from './types';
import { LeadChangeBanner } from '../moments/LeadChangeBanner';
import { ComebackBanner } from '../moments/ComebackBanner';
import { DoubleBanner } from '../moments/DoubleBanner';
import { MilestoneBanner } from '../moments/MilestoneBanner';
import { GiftMomentView } from '../moments/GiftMomentView';
import { GiftAggregateToast } from '../moments/GiftAggregateToast';
import { SystemNoticeToast } from '../moments/SystemNoticeToast';
import { Avatar } from '../ui/Avatar';

export type MomentSurface = 'corner' | 'banner';

function Pill({ tone, icon, children }: { tone: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`plv-banner-pill plv-banner-pill--${tone}`} role="status">
      <span className="plv-banner-pill-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </div>
  );
}

function Toast({ icon, title, detail, tone = 'info' }: { icon: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; tone?: string }) {
  return (
    <div className={`live-moment-toast plv-toast-moment plv-toast-moment--${tone}`} role="status">
      <span className="plv-toast-moment-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="live-moment-details">
        <span className="live-moment-sender">{title}</span>
        {detail && <span className="live-moment-action">{detail}</span>}
      </div>
    </div>
  );
}

const name = (u: { display_name: string; handle: string } | null | undefined) => (u ? u.display_name || `@${u.handle}` : 'Someone');

export function renderMoment(moment: AnyMoment, surface: MomentSurface): React.ReactNode {
  switch (moment.key) {
    case 'gift_common':
    case 'gift_rare':
    case 'gift_epic':
    case 'gift_legendary':
      return <GiftMomentView payload={moment.payload as MomentPayloads['gift_common']} variant={surface === 'banner' ? 'banner' : 'corner'} />;
    case 'gift_aggregate':
      return <GiftAggregateToast payload={moment.payload as MomentPayloads['gift_aggregate']} />;
    case 'gift_streak': {
      const p = moment.payload as MomentPayloads['gift_streak'];
      return (
        <div className="live-moment-toast plv-streak" role="status">
          <Avatar user={p.sender} size={32} decorative />
          <div className="live-moment-details">
            <span className="live-moment-sender">{name(p.sender)}</span>
            <span className="live-moment-action">
              {p.gift.name} streak
            </span>
          </div>
          <span className="plv-streak-count" aria-label={`${p.streak} in a row`}>
            ×{p.streak}
          </span>
        </div>
      );
    }
    case 'supporter_top': {
      const p = moment.payload as MomentPayloads['supporter_top'];
      return (
        <div className="live-moment-toast plv-toast-moment--gold" role="status">
          <Avatar user={p.supporter} size={32} ring="gold" decorative />
          <div className="live-moment-details">
            <span className="live-moment-sender">{name(p.supporter)}</span>
            <span className="live-moment-action">
              <Crown size={12} aria-hidden="true" /> Now the top supporter · {p.total.toLocaleString()} coins
            </span>
          </div>
        </div>
      );
    }
    case 'supporter_milestone': {
      const p = moment.payload as MomentPayloads['supporter_milestone'];
      return surface === 'banner' ? (
        <MilestoneBanner type="supporter" title={`${p.threshold.toLocaleString()} coins of support`} subtitle={name(p.supporter)} />
      ) : (
        <Toast tone="gold" icon={<Avatar user={p.supporter} size={32} decorative />} title={name(p.supporter)} detail={`Reached ${p.threshold.toLocaleString()} coins of support`} />
      );
    }
    case 'viewers_joined': {
      const p = moment.payload as MomentPayloads['viewers_joined'];
      const first = p.sample[0];
      const title = first ? (p.count > 1 ? `${name(first)} and ${p.count - 1} others` : name(first)) : `${p.count} people`;
      return <Toast icon={<LogIn size={16} />} title={title} detail="joined the LIVE" />;
    }
    case 'viewer_milestone': {
      const p = moment.payload as MomentPayloads['viewer_milestone'];
      return <MilestoneBanner type="viewer" title={`${p.milestone.toLocaleString()} people watching`} />;
    }
    case 'follow': {
      const p = moment.payload as MomentPayloads['follow'];
      const first = p.followers[0];
      const title = first ? (p.count > 1 ? `${name(first)} and ${p.count - 1} others` : name(first)) : `${p.count} people`;
      return <Toast tone="iris" icon={<UserPlus size={16} />} title={title} detail="followed the host" />;
    }
    case 'follow_milestone': {
      const p = moment.payload as MomentPayloads['follow_milestone'];
      return (
        <Pill tone="info" icon={<UserPlus size={15} />}>
          {p.milestone.toLocaleString()} new followers this LIVE
        </Pill>
      );
    }
    case 'guest_joined': {
      const p = moment.payload as MomentPayloads['guest_joined'];
      return <Toast tone="mint" icon={<Avatar user={p.guest} size={32} decorative />} title={name(p.guest)} detail="joined the stage" />;
    }
    case 'guest_left': {
      const p = moment.payload as MomentPayloads['guest_left'];
      const detail = p.reason === 'removed' ? 'was removed from the stage' : p.reason === 'disconnected' ? 'lost connection and left the stage' : 'left the stage';
      return <Toast icon={<LogOut size={16} />} title={name(p.guest)} detail={detail} />;
    }
    case 'double_warning':
      return <DoubleBanner status="warning" multiplier={(moment.payload as MomentPayloads['double_warning']).multiplier} />;
    case 'double_started':
      return <DoubleBanner status="active" multiplier={(moment.payload as MomentPayloads['double_started']).multiplier} />;
    case 'double_ended':
      return <Toast icon={<TimerOff size={16} />} title="Bonus ended" detail="Points are back to normal" />;
    case 'pull_started': {
      const p = moment.payload as MomentPayloads['pull_started'];
      return (
        <Pill tone="round" icon={<Flag size={15} />}>
          Round {p.pull} of {p.total}
          {p.multiplier > 1 ? ` · ${p.multiplier}× points` : ''}
        </Pill>
      );
    }
    case 'final_countdown':
      return (
        <Pill tone="final" icon={<Hourglass size={15} />}>
          Final seconds — every gift counts
        </Pill>
      );
    case 'lead_change':
    case 'lead_change_final': {
      const p = moment.payload as MomentPayloads['lead_change'];
      return <LeadChangeBanner leadSide={p.lead_side} leader={p.leader} scoreA={p.score_a} scoreB={p.score_b} isFinalMoment={moment.key === 'lead_change_final'} />;
    }
    case 'comeback': {
      const p = moment.payload as MomentPayloads['comeback'];
      return <ComebackBanner side={p.side} host={p.host} deficitBefore={p.deficit_before} deficitAfter={p.deficit_after} />;
    }
    case 'swing': {
      const p = moment.payload as MomentPayloads['swing'];
      return <Toast tone="gold" icon={<Zap size={16} />} title={`${name(p.sender)} swung the battle`} detail={`+${p.points.toLocaleString()} points with ${p.gift.name}`} />;
    }
    case 'system_notice': {
      const p = moment.payload as MomentPayloads['system_notice'];
      return <SystemNoticeToast message={p.message} severity={p.severity} />;
    }
    case 'moderation_notice': {
      const p = moment.payload as MomentPayloads['moderation_notice'];
      return surface === 'banner' ? (
        <Pill tone="warn" icon={<ShieldAlert size={15} />}>
          {p.message}
        </Pill>
      ) : (
        <SystemNoticeToast message={p.message} severity="warning" />
      );
    }
    case 'live_ended':
      return <Toast icon={<Users size={16} />} title="This LIVE has ended" />;
    default:
      // Stage-only presentations (battle intro/countdown/results) and bar effects are drawn
      // by StageHost / BarFxHost.
      return null;
  }
}
