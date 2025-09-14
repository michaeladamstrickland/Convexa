"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemHealthController = void 0;
const attomService_1 = __importDefault(require("../services/attomService"));
const batchService_1 = __importDefault(require("../services/batchService"));
/**
 * System Health Controller
 *
 * Provides endpoints to check the status of the system and its integrations
 */
class SystemHealthController {
    /**
     * Get the overall system health status
     *
     * @param req Express request
     * @param res Express response
     */
    async getSystemHealth(req, res) {
        const healthStatus = {
            timestamp: new Date(),
            version: process.env.npm_package_version || '1.0.0',
            status: 'ok',
            services: []
        };
        try {
            // Check ATTOM API health
            const attomHealth = await attomService_1.default.checkHealth();
            healthStatus.services.push(attomHealth);
            // Check BatchData API health
            const batchHealth = await batchService_1.default.checkHealth();
            healthStatus.services.push(batchHealth);
            // Determine overall status
            const hasUnhealthyServices = healthStatus.services.some(service => service.status === 'unhealthy');
            if (hasUnhealthyServices) {
                healthStatus.status = 'degraded';
            }
            return res.json(healthStatus);
        }
        catch (error) {
            console.error('Error checking system health:', error);
            healthStatus.status = 'error';
            healthStatus.services.push({
                service: 'Health Check',
                status: 'error',
                message: error.message
            });
            return res.status(500).json(healthStatus);
        }
    }
    /**
     * Run a smoke test on vendor APIs
     *
     * @param req Express request
     * @param res Express response
     */
    async checkVendorHealth(req, res) {
        try {
            const results = {
                timestamp: new Date(),
                services: []
            };
            // Check ATTOM API with a simple test
            let attomResult;
            try {
                const attomTest = await attomService_1.default.getPropertyById('1234567');
                attomResult = {
                    service: 'ATTOM API',
                    status: attomTest.status === 'error' ? 'unhealthy' : 'healthy',
                    responseTime: 0, // Could track this more precisely
                    ...(attomTest.status === 'error' ? { message: attomTest.message } : {})
                };
            }
            catch (error) {
                attomResult = {
                    service: 'ATTOM API',
                    status: 'unhealthy',
                    message: error.message
                };
            }
            results.services.push(attomResult);
            // Check BatchData API with a simple test
            let batchResult;
            try {
                const batchTest = await batchService_1.default.skipTraceByAddress('123 Main St', 'Beverly Hills', 'CA', '90210');
                batchResult = {
                    service: 'BatchData API',
                    status: batchTest.status === 'error' ? 'unhealthy' : 'healthy',
                    responseTime: 0, // Could track this more precisely
                    ...(batchTest.status === 'error' ? { message: batchTest.message } : {})
                };
            }
            catch (error) {
                batchResult = {
                    service: 'BatchData API',
                    status: 'unhealthy',
                    message: error.message
                };
            }
            results.services.push(batchResult);
            return res.json(results);
        }
        catch (error) {
            return res.status(500).json({
                timestamp: new Date(),
                status: 'error',
                message: error.message
            });
        }
    }
}
exports.SystemHealthController = SystemHealthController;
exports.default = new SystemHealthController();
//# sourceMappingURL=systemHealthController.js.map