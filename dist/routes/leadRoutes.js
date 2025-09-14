"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const leadTemperatureController_1 = require("../controllers/leadTemperatureController");
const router = express_1.default.Router();
// POST /api/leads/:id/feedback - Submit feedback on a lead
router.post('/:id/feedback', leadTemperatureController_1.handleLeadFeedback);
// POST /api/leads/:id/score - Calculate and update AI score for a lead
router.post('/:id/score', leadTemperatureController_1.handleLeadScoring);
exports.default = router;
//# sourceMappingURL=leadRoutes.js.map