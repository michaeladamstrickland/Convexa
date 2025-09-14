import { Request, Response } from 'express';
/**
 * Unified Search Controller
 *
 * This controller integrates multiple data sources (ATTOM and BatchData)
 * to provide a comprehensive property search and lead generation system.
 */
export declare class UnifiedSearchController {
    /**
     * Search for a property by address
     *
     * @param req Express request
     * @param res Express response
     */
    searchByAddress(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Search for properties by ZIP code
     *
     * @param req Express request
     * @param res Express response
     */
    searchByZipCode(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get skip trace information for an existing lead
     *
     * @param req Express request
     * @param res Express response
     */
    skipTraceLead(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
declare const _default: UnifiedSearchController;
export default _default;
//# sourceMappingURL=unifiedSearchController.d.ts.map