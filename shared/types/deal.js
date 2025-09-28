// Utility functions for calculations
export function computeRoi(arv, offer, reno, closingPct, sellingPct, holdMonths, apr = 0.10) {
    const closing = offer * closingPct;
    const carry = (offer / 2 + reno / 2) * (apr / 12) * holdMonths; // simple interest on avg balance
    const selling = arv * sellingPct;
    const totalInvestment = offer + reno + closing + carry;
    const netProfit = arv - selling - totalInvestment;
    const roiPct = totalInvestment > 0 ? netProfit / totalInvestment : 0;
    return { totalInvestment, netProfit, roiPct };
}
export function computeArvFromComps(subjectSqft, comps) {
    const adjusted = comps.map(c => {
        const ppsf = c.salePrice / Math.max(c.sqft || subjectSqft, 1);
        const adj = ppsf * subjectSqft;
        return { ...c, adjustedPrice: Math.round(adj) };
    });
    // Trimmed mean - remove potential outliers
    const candidates = adjusted
        .sort((a, b) => (a.adjustedPrice || 0) - (b.adjustedPrice || 0))
        .slice(1, Math.max(3, adjusted.length - 1));
    const arv = candidates.length > 0
        ? Math.round(candidates.reduce((s, c) => s + (c.adjustedPrice || 0), 0) / candidates.length)
        : 0;
    return { arv, adjusted };
}
// Adapter functions for mapping external data to our model
export function mapAttomToDeal(attomData, leadId) {
    // Implementation will depend on ATTOM API structure
    return {
        leadId,
        source: "ATTOM",
        property: {
            address: attomData.address?.oneLine || "",
            city: attomData.address?.locality || "",
            state: attomData.address?.countrySubd || "",
            zip: attomData.address?.postal1 || "",
            apn: attomData.identifier?.apnOrig || "",
            beds: attomData.building?.rooms?.bathsTotal || undefined,
            baths: attomData.building?.rooms?.bathsTotal || undefined,
            sqft: attomData.building?.size?.universalsize || undefined,
            lotSqft: attomData.lot?.lotSize1 || undefined,
            yearBuilt: attomData.summary?.yearBuilt || undefined,
            attomId: attomData.identifier?.Id || undefined,
            estValue: attomData.avm?.amount?.value || undefined,
        }
    };
}
export function mapCompsToComparables(attomComps) {
    // Implementation will depend on ATTOM API structure
    return attomComps.map(comp => ({
        address: comp.address?.oneLine || "",
        distanceMi: comp.location?.distance || 0,
        salePrice: comp.sale?.amount?.value || 0,
        saleDate: comp.sale?.salesDate || new Date().toISOString(),
        beds: comp.building?.rooms?.bathsTotal || 0,
        baths: comp.building?.rooms?.bathsTotal || 0,
        sqft: comp.building?.size?.universalsize || 0,
        lotSqft: comp.lot?.lotSize1,
        yearBuilt: comp.summary?.yearBuilt,
    }));
}
//# sourceMappingURL=deal.js.map