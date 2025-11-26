// Based on google-sheet connector integration
import { google } from 'googleapis';
import { Quote } from "@shared/schema";
import { config } from "../config";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = config.replit.connectors.hostname;
  const xReplitToken = config.replit.identity 
    ? 'repl ' + config.replit.identity 
    : config.replit.renewal 
    ? 'depl ' + config.replit.renewal 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export async function exportQuotesToGoogleSheets(quotes: Quote[]): Promise<string> {
  try {
    const sheets = await getUncachableGoogleSheetClient();

    // Create a new spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `Quote Research - ${new Date().toISOString().split('T')[0]}`,
        },
        sheets: [
          {
            properties: {
              title: "Quotes",
            },
          },
        ],
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId!;
    
    // Get the actual sheet ID from the creation response (not always 0!)
    const sheetId = createResponse.data.sheets?.[0]?.properties?.sheetId ?? 0;

    // Prepare data for sheets
    const headers = ["Quote", "Speaker", "Author", "Work", "Year", "Reference", "Type", "Verified", "Source Confidence", "Sources"];
    const rows = quotes.map((q) => [
      q.quote,
      q.speaker || "",
      q.author || "",
      q.work || "",
      q.year || "",
      q.reference || "",
      q.type || "",
      q.verified ? "Yes" : "No",
      q.sourceConfidence || "",
      Array.isArray(q.sources) ? (q.sources as string[]).join(", ") : "",
    ]);

    const values = [headers, ...rows];

    // Update the spreadsheet with data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Quotes!A1",
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    // Format the header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.2,
                    green: 0.2,
                    blue: 0.2,
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 1,
                      green: 1,
                      blue: 1,
                    },
                    fontSize: 11,
                    bold: true,
                  },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
        ],
      },
    });

    return spreadsheetId;
  } catch (error) {
    console.error("Google Sheets export error:", error);
    throw new Error("Failed to export to Google Sheets");
  }
}
