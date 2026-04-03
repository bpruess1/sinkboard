import { SizeTier } from './types.js';
export declare const TIER_VALUES: Record<SizeTier, number>;
/** Hours of business time for a chest to sink from 0% to 100% depth */
export declare const TIER_SINK_HOURS: Record<SizeTier, number>;
/** Sink rate: depth percent gained per business-millisecond */
export declare const TIER_SINK_RATE_PER_MS: Record<SizeTier, number>;
/** Minimum raise percent from the worst meaningful update */
export declare const MIN_RAISE_PERCENT = 10;
/** Maximum raise percent from the best possible update */
export declare const MAX_RAISE_PERCENT = 90;
/** Business hours of survival per jewel level (capped at 3) */
export declare const JEWEL_THRESHOLD_HOURS = 24;
export declare const MAX_JEWEL_LEVEL = 3;
/** Depth percent at which the kraken can take a chest */
export declare const KRAKEN_DEPTH_THRESHOLD = 95;
/** DynamoDB table name */
export declare const TABLE_NAME = "SinkBoard";
/** SSM parameter name for Anthropic API key */
export declare const ANTHROPIC_KEY_PARAM = "/sinkboard/anthropic-api-key";
//# sourceMappingURL=constants.d.ts.map