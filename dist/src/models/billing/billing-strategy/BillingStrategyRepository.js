"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const luxon_1 = require("luxon");
class BillingStrategyRepository {
    constructor(tenantId) {
        this.billingStrategiesTable = "prime_billing_strategies";
        this.strategyAssignmentsTable = "prime_billing_strategy_assignments";
        this.strategyPricesTable = "prime_billing_strategy_prices";
        this.strategyConditionsTable = "prime_billing_strategy_conditions";
        this.promoCodesTable = "prime_billing_promo_codes";
        this.auditTable = "prime_billing_audit";
        if (!Number.isInteger(tenantId) || tenantId <= 0) {
            throw new Error("Invalid tenantId");
        }
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    /**
     * Updates an existing billing strategy.
     * @throws Error if strategy name is duplicate.
     */
    async updateStrategy(id, data) {
        const conn = await this.connection;
        if (data.name) {
            const isDuplicate = await this.checkDuplicateStrategy(data.name, id);
            if (isDuplicate) {
                throw new Error("Duplicate billing strategy name exists");
            }
        }
        try {
            await conn(this.billingStrategiesTable).where("id", id).update(data);
        }
        catch (error) {
            throw new Error(`Failed to update strategy: ${error.message}`);
        }
    }
    /**
     * Creates a new billing strategy.
     * @throws Error if strategy name is missing or duplicate exists.
     */
    async createStrategy(data) {
        const conn = await this.connection;
        if (!data.name)
            throw new Error("Strategy name is required");
        const isDuplicate = await this.checkDuplicateStrategy(data.name);
        if (isDuplicate) {
            throw new Error("Duplicate billing strategy name exists");
        }
        try {
            const [id] = await conn(this.billingStrategiesTable).insert(data).returning("id");
            return id;
        }
        catch (error) {
            throw new Error(`Failed to create strategy: ${error.message}`);
        }
    }
    /**
     * Assigns a strategy to an entity.
     * @throws Error if required fields are missing or assignment overlaps.
     */
    async assignStrategyToEntity(data) {
        const conn = await this.connection;
        if (!data.billing_strategy_id || !data.entity_type || !data.applies_from) {
            throw new Error("Missing required assignment fields");
        }
        if (data.applies_to && data.applies_to <= data.applies_from) {
            throw new Error("applies_to must be after applies_from");
        }
        const isOverlap = await this.checkAssignmentOverlap(data);
        if (isOverlap) {
            throw new Error("Assignment overlaps with existing billing strategy for this entity");
        }
        try {
            const [id] = await conn(this.strategyAssignmentsTable).insert(data).returning("id");
            return id;
        }
        catch (error) {
            throw new Error(`Failed to assign strategy: ${error.message}`);
        }
    }
    /**
     * Adds a price rule to a strategy.
     * @throws Error if price data is invalid.
     */
    async addStrategyPrice(data) {
        const conn = await this.connection;
        if (!data.billing_strategy_id || !data.price_type || data.amount < 0 || data.amount > 1000000) {
            throw new Error("Invalid price data: amount must be between 0 and 1,000,000");
        }
        if (!['percentage', 'flat'].includes(data.price_type)) {
            throw new Error("Invalid price type");
        }
        try {
            const [id] = await conn(this.strategyPricesTable).insert(data).returning("id");
            return id;
        }
        catch (error) {
            throw new Error(`Failed to add price: ${error.message}`);
        }
    }
    /**
     * Adds a condition to a strategy.
     * @throws Error if condition data is invalid.
     */
    async addCondition(data) {
        const conn = await this.connection;
        if (!data.billing_strategy_id || !data.condition_type) {
            throw new Error("Invalid condition data");
        }
        if (data.condition_type === 'day_of_week' && data.condition_value) {
            const days = data.condition_value.split(',');
            if (!days.every(d => /^[0-6]$/.test(d))) {
                throw new Error("day_of_week condition_value must be comma-separated numbers (0-6)");
            }
        }
        if (data.condition_type === 'time_of_day' && (data.start_time || data.end_time)) {
            if (!/^\d{2}:\d{2}$/.test(data.start_time || '') || !/^\d{2}:\d{2}$/.test(data.end_time || '')) {
                throw new Error("time_of_day start_time and end_time must be in HH:MM format");
            }
        }
        try {
            const [id] = await conn(this.strategyConditionsTable).insert(data).returning("id");
            return id;
        }
        catch (error) {
            throw new Error(`Failed to add condition: ${error.message}`);
        }
    }
    /**
     * Fetches active strategies for an entity.
     */
    async getActiveStrategiesForEntity(entityType, trackId) {
        const conn = await this.connection;
        try {
            return await conn
                .select("bs.*")
                .from(`${this.billingStrategiesTable} as bs`)
                .join(`${this.strategyAssignmentsTable} as a`, "bs.id", "a.billing_strategy_id")
                .where("a.entity_type", entityType)
                .andWhere("a.track_id", trackId)
                .andWhere("a.applies_from", "<=", conn.fn.now())
                .andWhere((builder) => builder.whereNull("a.applies_to").orWhere("a.applies_to", ">=", conn.fn.now()))
                .orderBy('bs.priority', 'desc'); // Added priority sorting
        }
        catch (error) {
            throw new Error(`Failed to fetch active strategies: ${error.message}`);
        }
    }
    async getAllStrategies() {
        const conn = await this.connection;
        try {
            return await conn(this.billingStrategiesTable).select("*").orderBy('priority', 'desc');
        }
        catch (error) {
            throw new Error(`Failed to fetch all strategies: ${error.message}`);
        }
    }
    async getStrategyPrices(strategyId) {
        const conn = await this.connection;
        try {
            return await conn(this.strategyPricesTable).where("billing_strategy_id", strategyId);
        }
        catch (error) {
            throw new Error(`Failed to fetch prices: ${error.message}`);
        }
    }
    async getConditions(strategyId) {
        const conn = await this.connection;
        try {
            return await conn(this.strategyConditionsTable).where("billing_strategy_id", strategyId);
        }
        catch (error) {
            throw new Error(`Failed to fetch conditions: ${error.message}`);
        }
    }
    async getStrategyAssignments(entityType, trackId, billing_strategy_id) {
        const conn = await this.connection;
        try {
            const result = await conn(this.strategyAssignmentsTable)
                .where("entity_type", entityType)
                .andWhere('trackId', trackId)
                .andWhere('billing_strategy_id', billing_strategy_id);
            return result[0];
        }
        catch (error) {
            throw new Error(`Failed to fetch strategy assignments: ${error.message}`);
        }
    }
    /**
     * Applies a promo code to the base price.
     * @returns The adjusted price or basePrice if no valid promo code.
     */
    async applyPromoCode(code, basePrice) {
        const conn = await this.connection;
        try {
            const promo = await conn(this.promoCodesTable)
                .where('code', code)
                .andWhere('is_active', 1)
                .andWhere('valid_from', '<=', conn.fn.now())
                .andWhere((builder) => builder.whereNull('valid_to').orWhere('valid_to', '>=', conn.fn.now()))
                .andWhere((builder) => builder.whereNull('max_uses').orWhere('times_used', '<', conn.raw('max_uses')))
                .first();
            if (!promo)
                return basePrice;
            const finalPrice = promo.discount_type === 'flat'
                ? basePrice - promo.discount_value
                : basePrice * (1 - promo.discount_value / 100);
            await conn(this.promoCodesTable)
                .where('id', promo.id)
                .increment('times_used', 1);
            return Number(Math.max(0, finalPrice).toFixed(2));
        }
        catch (error) {
            throw new Error(`Failed to apply promo code: ${error.message}`);
        }
    }
    /**
     * Calculates the final price for a test panel based on active billing strategies and optional promo code.
     * @param entityType - The type of entity (e.g., organization, clinician).
     * @param trackId - The specific track ID for the entity.
     * @param testPanelId - The ID of the test panel.
     * @param basePrice - The base price before discounts or surcharges.
     * @param currentDate - Optional date for price calculation (defaults to now).
     * @param promoCode - Optional promo code to apply.
     * @returns The calculated price, rounded to 2 decimal places.
     */
    async getCalculatedPrice(entityType, trackId, testPanelId, basePrice, currentDate, promoCode) {
        if (basePrice < 0 || !Number.isInteger(testPanelId) || testPanelId <= 0) {
            throw new Error("Invalid input parameters");
        }
        const now = currentDate ? luxon_1.DateTime.fromJSDate(currentDate) : luxon_1.DateTime.now();
        let finalPrice = basePrice;
        let appliedStrategyId = null;
        let appliedPriceId = null;
        let appliedPromoId = null;
        // Apply promo code if provided
        if (promoCode) {
            finalPrice = await this.applyPromoCode(promoCode, basePrice);
            const promo = await (await this.connection)(this.promoCodesTable).where('code', promoCode).first();
            appliedPromoId = (promo === null || promo === void 0 ? void 0 : promo.id) || null;
        }
        const strategies = await this.getActiveStrategiesForEntity(entityType, trackId);
        for (const strategy of strategies) {
            if (!strategy.id)
                continue;
            const [conditions, prices] = await Promise.all([
                this.getConditions(strategy.id),
                this.getStrategyPrices(strategy.id),
            ]);
            const allConditionsPass = conditions.every((cond) => {
                switch (cond.condition_type) {
                    case "time_of_day": {
                        if (!cond.start_time || !cond.end_time)
                            return false;
                        const timezone = cond.timezone || "Africa/Accra";
                        const nowInTimezone = now.setZone(timezone);
                        const nowStr = nowInTimezone.toFormat("HH:mm");
                        return nowStr >= cond.start_time && nowStr <= cond.end_time;
                    }
                    case "day_of_week": {
                        if (!cond.condition_value)
                            return false;
                        const currentDay = now.weekday % 7; // 0 (Sunday) to 6 (Saturday)
                        try {
                            return cond.condition_value.split(",").includes(currentDay.toString());
                        }
                        catch (_a) {
                            return false;
                        }
                    }
                    case "date_time_range": {
                        if (!cond.start_datetime || !cond.end_datetime)
                            return false;
                        return now.toJSDate() >= cond.start_datetime && now.toJSDate() <= cond.end_datetime;
                    }
                    case "custom":
                        // Placeholder: Implement custom logic here
                        return true;
                    default:
                        return true;
                }
            });
            if (!allConditionsPass)
                continue;
            const price = prices.find((p) => p.test_panel_id === testPanelId) ||
                prices.find((p) => p.test_panel_id === null);
            if (!price)
                continue;
            appliedStrategyId = strategy.id;
            appliedPriceId = price.id;
            if (price.price_type === "flat") {
                finalPrice = price.amount;
            }
            else if (price.price_type === "percentage") {
                const adjustment = (price.amount / 100) * basePrice;
                finalPrice = strategy.is_discount ? basePrice - adjustment : basePrice + adjustment;
            }
            break; // Apply first valid strategy
        }
        finalPrice = Number(Math.max(0, finalPrice).toFixed(2));
        // Log audit record
        try {
            const conn = await this.connection;
            await conn(this.auditTable).insert({
                entity_type: entityType,
                track_id: trackId,
                test_panel_id: testPanelId,
                base_price: basePrice,
                final_price: finalPrice,
                strategy_id: appliedStrategyId,
                price_id: appliedPriceId,
                promo_code_id: appliedPromoId,
                calculated_at: conn.fn.now(),
            });
        }
        catch (error) {
            console.error(`Failed to log audit: ${error.message}`);
        }
        return finalPrice;
    }
    async checkDuplicateStrategy(name, excludeId) {
        const conn = await this.connection;
        try {
            const query = conn(this.billingStrategiesTable).where("name", name);
            if (excludeId) {
                query.andWhere("id", "!=", excludeId);
            }
            const existing = await query.first();
            return !!existing;
        }
        catch (error) {
            throw new Error(`Failed to check duplicate strategy: ${error.message}`);
        }
    }
    async checkAssignmentOverlap(data) {
        const conn = await this.connection;
        try {
            const overlapping = await conn(this.strategyAssignmentsTable)
                .where("entity_type", data.entity_type)
                .andWhere("track_id", data.track_id)
                .andWhere(function () {
                this.where(function () {
                    this.where("applies_from", "<=", data.applies_to || "9999-12-31");
                    this.where(function () {
                        this.whereNull("applies_to").orWhere("applies_to", ">=", data.applies_from);
                    });
                });
            })
                .first();
            return !!overlapping;
        }
        catch (error) {
            throw new Error(`Failed to check assignment overlap: ${error.message}`);
        }
    }
}
exports.default = BillingStrategyRepository;
