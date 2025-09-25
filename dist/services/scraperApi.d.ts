export declare const authApi: import("axios").AxiosInstance;
export declare const scraperApi: {
    startScraper: (source: string, config: any) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    getJobs: (params: {
        limit?: number;
        page?: number;
        status?: string;
        source?: string;
    }) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    getJobById: (jobId: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    processRecords: (jobId: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    getSchedules: () => Promise<import("axios").AxiosResponse<any, any, {}>>;
    createSchedule: (data: {
        name: string;
        scraperType: string;
        cronExpression: string;
        config: any;
    }) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    updateSchedule: (scheduleId: string, data: {
        name?: string;
        cronExpression?: string;
        config?: any;
        isActive?: boolean;
    }) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    deleteSchedule: (scheduleId: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    runSchedule: (scheduleId: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    getPropertyRecords: (params: {
        limit?: number;
        page?: number;
        processed?: boolean;
        source?: string;
        jobId?: string;
    }) => Promise<import("axios").AxiosResponse<any, any, {}>>;
};
//# sourceMappingURL=scraperApi.d.ts.map