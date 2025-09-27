export function computeScoreAndTags(input) {
    let base = 50;
    const reasons = [];
    const tagReasons = [];
    const price = input.price ?? null;
    const sqft = input.sqft ?? null;
    const condition = input.condition || inferCondition(price, sqft);
    if (typeof sqft === 'number') {
        if (sqft > 1200) {
            base += 10;
            reasons.push('sqft>1200:+10');
        }
        else if (sqft < 800) {
            base -= 10;
            reasons.push('sqft<800:-10');
        }
    }
    if (typeof price === 'number') {
        if (price < 150000) {
            base += 10;
            reasons.push('price<150k:+10');
        }
        else if (price > 350000) {
            base -= 5;
            reasons.push('price>350k:-5');
        }
    }
    if (condition === 'NeedsWork') {
        base += 15;
        reasons.push('condition=NeedsWork:+15');
    }
    if (base < 0)
        base = 0;
    if (base > 100)
        base = 100;
    const tags = [];
    if (base > 80) {
        tags.push('high-potential');
        tagReasons.push({ tag: 'high-potential', reason: 'score>80 threshold met' });
    }
    if ((typeof sqft === 'number' && sqft < 800) && (typeof price === 'number' && price > 300000)) {
        tags.push('low-margin');
        tagReasons.push({ tag: 'low-margin', reason: 'small sqft AND high price suggest thinner margins' });
    }
    return { score: base, tags, condition, reasons, tagReasons };
}
function inferCondition(price, sqft) {
    if ((price !== null && price < 120000) || (sqft !== null && sqft < 900))
        return 'NeedsWork';
    return 'Fair';
}
//# sourceMappingURL=scoring.js.map