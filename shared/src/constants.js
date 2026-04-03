export const TIER_VALUES = {
    S: 1,
    M: 2,
    L: 4,
    XL: 8,
};
/** Hours of business time for a chest to sink from 0% to 100% depth */
export const TIER_SINK_HOURS = {
    S: 120, // 5 business days
    M: 72,
    L: 48,
    XL: 24,
};
/** Sink rate: depth percent gained per business-millisecond */
export const TIER_SINK_RATE_PER_MS = {
    S: 100 / (120 * 3600 * 1000),
    M: 100 / (72 * 3600 * 1000),
    L: 100 / (48 * 3600 * 1000),
    XL: 100 / (24 * 3600 * 1000),
};
/** Minimum raise percent from the worst meaningful update */
export const MIN_RAISE_PERCENT = 10;
/** Maximum raise percent from the best possible update */
export const MAX_RAISE_PERCENT = 90;
/** Business hours of survival per jewel level (capped at 3) */
export const JEWEL_THRESHOLD_HOURS = 24;
export const MAX_JEWEL_LEVEL = 3;
/** Depth percent at which the kraken can take a chest */
export const KRAKEN_DEPTH_THRESHOLD = 95;
/** DynamoDB table name */
export const TABLE_NAME = 'SinkBoard';
/** SSM parameter name for Anthropic API key */
export const ANTHROPIC_KEY_PARAM = '/sinkboard/anthropic-api-key';
//# sourceMappingURL=constants.js.map