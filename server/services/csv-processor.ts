export interface CSVRow {
  query: string;
  searchType: "topic" | "author" | "work";
  maxQuotes: number;
}

export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) return [];
  
  const rows: CSVRow[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length >= 3) {
      const searchType = values[1].toLowerCase();
      const maxQuotes = parseInt(values[2], 10);
      
      if ((searchType === "topic" || searchType === "author" || searchType === "work") && maxQuotes > 0 && maxQuotes <= 1000) {
        rows.push({
          query: values[0],
          searchType: searchType as "topic" | "author" | "work",
          maxQuotes,
        });
      }
    }
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}
