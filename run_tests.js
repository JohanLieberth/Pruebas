// Mock Apps Script Classes
global.Logger = {
  log: (...args) => console.log(...args)
};

global.SpreadsheetApp = {
  getActiveSpreadsheet: () => mockSS,
  create: () => mockSS,
  openById: () => mockSS,
  open: () => mockSS
};

global.DriveApp = {
  getFilesByName: () => ({ hasNext: () => false })
};

global.PropertiesService = {
  getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} })
};

global.Session = {
  getActiveUser: () => ({ getEmail: () => 'contraloria@merida.gob.mx' })
};

global.HtmlService = {
  createTemplateFromFile: () => ({ evaluate: () => ({ setTitle: () => ({ setXFrameOptionsMode: () => ({ addMetaTag: () => {} }) }) }) }),
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
};

global.Utilities = {
  getUuid: () => '12345678-1234-1234-1234-123456789012',
  formatDate: (date, tz, fmt) => '2025-10-09 10:00:00'
};

class MockSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
  }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data[0] ? this.data[0].length : 0; }
  appendRow(row) { this.data.push(row); }
  getDataRange() {
    return {
      getValues: () => this.data
    };
  }
  getRange(r, c, numR, numC) {
    return {
      setFontWeight: () => ({ setBackground: () => ({ setFontColor: () => {} }) }),
      setValues: (vals) => {
        for (let i = 0; i < vals.length; i++) {
          this.data[r - 1 + i] = vals[i];
        }
      },
      setValue: (val) => {
        if (!this.data[r - 1]) this.data[r - 1] = [];
        this.data[r - 1][c - 1] = val;
      }
    };
  }
  deleteRow(index) {
    this.data.splice(index - 1, 1);
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = {};
  }
  getSheetByName(name) {
    return this.sheets[name] || null;
  }
  insertSheet(name) {
    const s = new MockSheet(name);
    this.sheets[name] = s;
    return s;
  }
}

const mockSS = new MockSpreadsheet();

// Load Code.gs and TestVerificacion.gs
const fs = require('fs');
const codeGS = fs.readFileSync('./Code.gs', 'utf8');
const testGS = fs.readFileSync('./TestVerificacion.gs', 'utf8');

eval(codeGS);
eval(testGS);

// Run setup
setupDatabase();

// Execute Suite
console.log("Running Google Apps Script Automated Tests in Node.js...");
const res = correrSuitePruebasVerificacion();
if (res.falladas > 0) {
  process.exit(1);
} else {
  console.log("All verifications passed successfully!");
}
