"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const unifiedSearchController_1 = __importDefault(require("../controllers/unifiedSearchController"));
const router = express_1.default.Router();
/**
 * Property search routes for ATTOM and BatchData integration
 */
// Search for a property by address
router.post('/search/address', unifiedSearchController_1.default.searchByAddress);
// Search for properties by ZIP code
router.post('/search/zip', unifiedSearchController_1.default.searchByZipCode);
// Skip trace an existing lead
router.post('/leads/skip-trace', unifiedSearchController_1.default.skipTraceLead);
exports.default = router;
//# sourceMappingURL=propertySearchRoutes.js.map