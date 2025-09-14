"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const systemHealthController_1 = __importDefault(require("../controllers/systemHealthController"));
const router = express_1.default.Router();
/**
 * System health and monitoring routes
 */
// Get overall system health status
router.get('/health', systemHealthController_1.default.getSystemHealth);
// Check vendor API health
router.get('/vendor-health', systemHealthController_1.default.checkVendorHealth);
exports.default = router;
//# sourceMappingURL=systemRoutes.js.map