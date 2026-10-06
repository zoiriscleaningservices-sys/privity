/**
 * MediaTransport — the seam between Stage 3 screens and the real media layer.
 *
 * Screens publish their OWN processed camera/mic and read everyone else's presence through
 * this interface. Stage 4 implements it with LiveKit (publish = localParticipant tracks,
 * presence = remote participants / track subscriptions / connection quality). The LIVE Lab
 * implements it with an in-page loopback so multi-role screens can be exercised together.
 *
 * Publishing only ever describes THIS device's media; there is no API to switch another
 * participant's camera or microphone.
 */

import type { MediaPresenceSource } from './LiveRoomController';

export interface PublishedMedia {
  /** Processed video (FilterPipeline.captureStream) plus, optionally, the mic track. */
  stream: MediaStream | null;
  cameraOn: boolean;
  micOn: boolean;
}

export interface MediaTransport extends MediaPresenceSource {
  publish(participantId: string, media: PublishedMedia): void;
  unpublish(participantId: string): void;
}
