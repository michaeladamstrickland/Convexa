import { Request, Response } from 'express';
/**
 * System Health Controller
 *
 * Provides endpoints to check the status of the system and its integrations
 */
export declare class SystemHealthController {
    /**
     * Get the overall system health status
     *
     * @param req Express request
     * @param res Express response
     */
    getSystemHealth(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Run a smoke test on vendor APIs
     *
     * @param req Express request
     * @param res Express response
     */
    checkVendorHealth(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
declare const _default: SystemHealthController;
export default _default;
//# sourceMappingURL=systemHealthController.d.ts.map