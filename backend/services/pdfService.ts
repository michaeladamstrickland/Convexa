import { DealAnalysis } from '../../shared/types/deal';
import { chromium } from 'playwright';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper function to format currency
handlebars.registerHelper('formatCurrency', (value: number | undefined) => {
  if (value === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
});

// Helper function to format percentage
handlebars.registerHelper('formatPercent', (value: number | undefined) => {
  if (value === undefined) return '0%';
  return `${(value * 100).toFixed(1)}%`;
});

// Helper function to format date
handlebars.registerHelper('formatDate', (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

// Generate PDF from deal analysis
export async function generatePdf(dealData: DealAnalysis): Promise<Buffer> {
  // Read the HTML template
  const templatePath = path.resolve(__dirname, '../templates/dealReport.html');
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  
  // Compile the template
  const template = handlebars.compile(templateContent);
  
  // Prepare data for the template
  const data = {
    deal: dealData,
    generatedDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };
  
  // Render the HTML
  const html = template(data);
  
  // Launch browser to generate PDF
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set content and wait for fonts/images to load
  await page.setContent(html, { waitUntil: 'networkidle' });
  
  // Generate PDF
  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: {
      top: '1cm',
      bottom: '1cm',
      left: '1cm',
      right: '1cm'
    }
  });
  
  // Close browser
  await browser.close();
  
  return pdf;
}

// Create a simplified version for testing without Playwright
export async function generateSimplePdf(dealData: DealAnalysis): Promise<Buffer> {
  // This is a simplified version that returns the HTML as a buffer
  // In production, use the Playwright version above
  
  // Create a simple HTML template
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Deal Analysis Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        h1 { color: #2c3e50; }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 20px; }
        .property-info { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .metric { background-color: #f8f9fa; padding: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Deal Analysis Report</h1>
        <p>${dealData.property.address}, ${dealData.property.city}, ${dealData.property.state} ${dealData.property.zip}</p>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="section">
        <h2>Property Details</h2>
        <div class="property-info">
          <p><strong>Beds:</strong> ${dealData.property.beds || 'N/A'}</p>
          <p><strong>Baths:</strong> ${dealData.property.baths || 'N/A'}</p>
          <p><strong>Square Footage:</strong> ${dealData.property.sqft?.toLocaleString() || 'N/A'}</p>
          <p><strong>Year Built:</strong> ${dealData.property.yearBuilt || 'N/A'}</p>
          <p><strong>After Repair Value (ARV):</strong> $${dealData.property.arv?.toLocaleString() || 'N/A'}</p>
        </div>
      </div>
      
      <div class="section">
        <h2>Financial Summary</h2>
        <div class="metrics">
          <div class="metric">
            <p><strong>Purchase Price:</strong> $${dealData.purchase.offerPrice.toLocaleString()}</p>
          </div>
          <div class="metric">
            <p><strong>Renovation Budget:</strong> $${dealData.renovation.budget.toLocaleString()}</p>
          </div>
          <div class="metric">
            <p><strong>Total Investment:</strong> $${dealData.results.totalInvestment.toLocaleString()}</p>
          </div>
          <div class="metric">
            <p><strong>Net Profit:</strong> $${dealData.results.netProfit.toLocaleString()}</p>
          </div>
          <div class="metric">
            <p><strong>ROI:</strong> ${(dealData.results.roiPct * 100).toFixed(1)}%</p>
          </div>
          <div class="metric">
            <p><strong>Risk Score:</strong> ${dealData.results.riskScore}/100</p>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2>Comparable Sales</h2>
        <table>
          <tr>
            <th>Address</th>
            <th>Sale Price</th>
            <th>Sale Date</th>
            <th>Beds</th>
            <th>Baths</th>
            <th>Sqft</th>
            <th>Distance</th>
          </tr>
          ${dealData.comps.map(comp => `
            <tr>
              <td>${comp.address}</td>
              <td>$${comp.salePrice.toLocaleString()}</td>
              <td>${new Date(comp.saleDate).toLocaleDateString()}</td>
              <td>${comp.beds}</td>
              <td>${comp.baths}</td>
              <td>${comp.sqft.toLocaleString()}</td>
              <td>${comp.distanceMi.toFixed(1)} mi</td>
            </tr>
          `).join('')}
        </table>
      </div>
      
      <div class="section">
        <h2>Renovation Budget</h2>
        <table>
          <tr>
            <th>Category</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Unit Cost</th>
            <th>Subtotal</th>
          </tr>
          ${dealData.renovation.lineItems.map(item => `
            <tr>
              <td>${item.category}</td>
              <td>${item.name}</td>
              <td>${item.qty}</td>
              <td>${item.unit}</td>
              <td>$${item.unitCost.toLocaleString()}</td>
              <td>$${item.subtotal.toLocaleString()}</td>
            </tr>
          `).join('')}
        </table>
      </div>
      
      <div class="section">
        <h2>Recommendation</h2>
        <div class="property-info">
          <p><strong>Deal Rating:</strong> ${dealData.results.recommendation}</p>
          ${dealData.results.notes && dealData.results.notes.length > 0 ? `
            <p><strong>Notes:</strong></p>
            <ul>
              ${dealData.results.notes.map(note => `<li>${note}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
  
  return Buffer.from(html);
}
