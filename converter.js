const fs = require('fs');
const moment = require('moment');
const Papa = require('papaparse');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const prompt = require('prompt-sync')();

class Converter {
    constructor(cellfile, idfile) {
        const cellData = fs.readFileSync(cellfile, 'utf8');
        const idData = fs.readFileSync(idfile, 'utf8');
        this.df = Papa.parse(cellData, { header: true, delimiter: ';' }).data;
        this.id_df = Papa.parse(idData, { header: true, delimiter: ';' }).data;
        this.ope = "";
    }

    removeUselessColumnsandData() {
        this.df = this.df.map(row => {
            delete row.TAC;
            delete row.Date;
            delete row.FirstDate;
            delete row.LastDate;
            delete row.Flag;
            delete row.RF;
            return row;
        }).filter(row => row.NOM && row.NOM !== 'Données insuffisantes');
    }

    mergingIdinCells() {
        const idMap = this.id_df.reduce((map, row) => {
            map[row.eNB] = row;
            return map;
        }, {});

        this.df = this.df.map(row => {
            if (idMap[row.eNB]) {
                row.Latitude = idMap[row.eNB].Lat;
                row.Longitude = idMap[row.eNB].Lon;
            }
            return row;
        }).filter(row => row.Latitude && row.Longitude);
    }

    renameAndReorderColumns() {
        this.mergingIdinCells();
        const opeList = ["ORANGE", "BYTEL", "SFR", "FREE"];
        
        const ope = prompt("Quel opérateur ? (Orange, ByTel, ..) : ").toUpperCase();

        if (!opeList.includes(ope)) {
            console.log("Opérateur non reconnu.");
            process.exit(1);
        }

        this.ope = ope;

        this.df = this.df
            .filter(row => row.OP.toUpperCase() === this.ope)
            .map(row => {
                row.ECellID = (parseInt(row.eNB) * 256) + parseInt(row.CID);
                row.CellName = row.NOM;
                row.EARFCN = row.ARFCN;
                row.Azimuth = -1;
                return {
                    ECellID: row.ECellID,
                    CellName: row.CellName,
                    Longitude: row.Longitude,
                    Latitude: row.Latitude,
                    PCI: row.PCI,
                    EARFCN: row.EARFCN,
                    Azimuth: row.Azimuth
                };
            });

        this.df.sort((a, b) => a.ECellID - b.ECellID);
    }

    save() {
        const ajd = moment();
        const date_actu = ajd.format("YYYY-MM-DD_HH_mm_ss");
        const save = `NSG_${this.ope}_${date_actu}.csv`;

        const csvWriter = createCsvWriter({
            path: `output/${save}`,
            header: [
                { id: 'ECellID', title: 'ECellID' },
                { id: 'CellName', title: 'CellName' },
                { id: 'Longitude', title: 'Longitude' },
                { id: 'Latitude', title: 'Latitude' },
                { id: 'PCI', title: 'PCI' },
                { id: 'EARFCN', title: 'EARFCN' },
                { id: 'Azimuth', title: 'Azimuth' }
            ]
        });

        csvWriter.writeRecords(this.df)
            .then(() => console.log(`Fichier ${save} sauvegardé`));
    }

    convertToNewFile() {
        this.removeUselessColumnsandData();
        this.renameAndReorderColumns();
        this.save();
        console.log("Conversion terminée.");
    }
}

// Exemple d'utilisation
convert = new Converter("ExportV5_1699024208_M2101K9G.csv", "Identifications_1699024222.csv")
convert.convertToNewFile();


