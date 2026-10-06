/**
 * Privity LIVE v2 — public surface of the client core (behind the `live_v2` flag).
 * Nothing here is authoritative: scores, multipliers, leaders and winners come from the server.
 */

export * from './core/events';
export { ServerClock } from './core/serverClock';
export { LiveEventStore, defaultTimers } from './core/EventStore';
export type { Timers, EventStoreDeps, EventStoreListener, EventStoreStatus, DeliveryContext } from './core/EventStore';
export { roomStateFromSnapshot, applyLiveEvent, clearFinishedBattle } from './core/roomState';
export type { LiveRoomState } from './core/roomState';

export { BUILTIN_FORMATS, FORMAT_LIMITS, compileTimeline, segmentAt, validateFormat } from './battle/timeline';
export type { BattleFormatDefinition, CompiledTimeline, FormatSegment } from './battle/timeline';
export { deriveBattleView, barShareA, formatBattleClock, DEFAULT_DERIVE_OPTIONS } from './battle/deriveBattleView';
export type { BattleView, BattleStage, BonusState, Intensity } from './battle/deriveBattleView';

export { BattleBar } from './battle/BattleBar';
export { BattleTimer } from './battle/BattleTimer';
export { BattlePhaseBadge } from './battle/BattlePhaseBadge';
export { PullProgress } from './battle/PullProgress';
export { BattleIntro } from './battle/BattleIntro';
export { BattleResults } from './battle/BattleResults';
export { BattleHud } from './battle/BattleHud';

export { DEFAULT_SHOW_CONFIG, mergeShowConfig, resultsDurationMs, PRIORITY_RANK } from './show/config';
export type { LiveShowConfig, MomentKey, MomentLane, MomentPriority, MomentSpec, HapticPattern } from './show/config';
export type { AnyMoment, LiveMoment, ActiveMoment, ShowChatLine, MomentPayloads, GiftMomentPayload } from './show/types';
export { MomentScheduler, SHOW_LANES } from './show/scheduler';
export type { ShowLane, DropReason } from './show/scheduler';
export { MomentAggregator } from './show/aggregator';
export {
  EffectsController,
  HAPTIC_PATTERNS,
  createAudioSoundPlayer,
  detectReducedMotion,
  loadEffectPrefs,
  saveEffectPrefs,
} from './show/effects';
export type { EffectPrefs, SoundPlayer } from './show/effects';
export { LiveShowEngine } from './show/LiveShowEngine';
export type { LiveShowEngineOptions } from './show/LiveShowEngine';
export { useLane, useBattleView, useShowChat, useEffectPrefs } from './show/useLane';

export { StageHost } from './show/StageHost';
export { BannerHost } from './show/BannerHost';
export { CornerHost } from './show/CornerHost';
export { BarFxHost } from './show/BarFxHost';

export { GiftMomentView } from './moments/GiftMomentView';
export { GiftAggregateToast } from './moments/GiftAggregateToast';
export { TopSupporterChip } from './moments/TopSupporterChip';
export { FeaturedSupporterCard } from './moments/FeaturedSupporterCard';
export { LeadChangeBanner } from './moments/LeadChangeBanner';
export { ComebackBanner } from './moments/ComebackBanner';
export { DoubleBanner } from './moments/DoubleBanner';
export { MilestoneBanner } from './moments/MilestoneBanner';
export { SystemNoticeToast } from './moments/SystemNoticeToast';

// Stage 3 UI Screens & Components
export { HostStudio } from './ui/HostStudio';
export type { HostStudioProps } from './ui/HostStudio';
export { ViewerLiveScreen } from './ui/ViewerLiveScreen';
export type { ViewerLiveScreenProps } from './ui/ViewerLiveScreen';
export { LiveFrame } from './ui/LiveFrame';
export { VideoStage } from './ui/VideoStage';
export type { TileModel } from './ui/VideoStage';
export { CommentList, CommentComposer } from './ui/Comments';
export { GiftTray } from './ui/GiftTray';
export type { GiftTrayProps } from './ui/GiftTray';
export { FilterSheet } from './ui/FilterSheet';
export { StageManagerSheet } from './ui/StageManagerSheet';
export { ShowOverlay } from './ui/ShowOverlay';
export { Avatar } from './ui/Avatar';
export { ConnectionIndicator, LiveBadge, ViewerCount, StateScreen, InlineNotice, useToasts, ToastStack } from './ui/status';

// Stage 3 Media & Pipeline
export { FilterPipeline } from './media/FilterPipeline';
export { FilteredPreview, StreamVideo } from './media/FilteredPreview';
export { LocalMediaController } from './media/LocalMediaController';
export type { LocalMediaState, MediaSourceKind } from './media/LocalMediaController';
export { TestPatternSource, createSilentAudioTrack } from './media/TestPatternSource';
export { DeviceFilterPresetStore } from './media/presetStore';
export { BUILTIN_PRESETS, NO_FILTER_ID } from './media/filterPresets';
export type { FilterParams, FilterPreset } from './media/filterTypes';

// Stage 3 Client & Transport
export { LiveRoomController } from './client/LiveRoomController';
export type { LiveFeed, LiveRoomControllerOptions, RoomView, PersonalNotice } from './client/LiveRoomController';
export type { LiveCommands, CommandResult, WalletInfo, CatalogGift, GiftCatalog, SendGiftInput, GiftSendData } from './client/LiveCommands';
export type { MediaTransport, PublishedMedia } from './client/mediaTransport';
export type { ConnectionState, MediaQuality, ParticipantMedia, ParticipantMediaStatus } from './client/connection';
export { describeLiveError } from './client/errors';

// Stage 3 Dev & Lab
export { LiveLab } from './dev/LiveLab';
export { SimulatedLiveBackend } from './dev/SimulatedLiveBackend';
export { LabMediaHub } from './dev/LabMediaHub';
