// run node script.js --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results
const minimist = require('minimist');
const axios = require('axios');
const fs = require('fs');
const jsdom = require('jsdom');
const excel = require('excel4node');
const QRCode = require('qrcode');
const path = require('path');
const pdf = require('pdf-lib');

let args = minimist(process.argv);

let htmlPromise = axios.get(args.source);
htmlPromise.then(function(res){
    let html = res.data;
    
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    let league = document.querySelectorAll("div.league-scores-container div.match-info");


    let tournament = [];
    for(let i=0;i<league.length;i++){


        let team = league[i].querySelectorAll("p.name");
        
        let score = league[i].querySelectorAll("span.score");
        let score1="--";
        let score2="--";
        if(score.length==2){
            score1 = score[0].textContent;
            score2 = score[1].textContent;
        }else if(score.length==1){
            score1 = score[0].textContent;
        }
        
        let data = {
            matchNo: league.length - i,
            team1 : team[0].textContent,
            team2 : team[1].textContent,
            score1: score1,
            score2: score2,
            result: league[i].querySelector("div.status-text").textContent
        }

        tournament.push(data);    
    }

    let teamsArr = createTeamsArr(tournament);

    fillMatchesInTeamsArr(tournament,teamsArr);
    
    createJsonFile(teamsArr);   // JSON File creation

    createExcelFile(teamsArr);  // Excel file creation

    createQrCodes(tournament);  // QR Code Creation

    setTimeout(createFolderAndPdf, 3000, teamsArr);  // calling creatFolderandpdf after 3s of delay
    

}).catch(function(err){
    console.log("Error occured...");
})


function createTeamsArr(tournament){
    let teamsArr = [];
    for(let i=0;i<tournament.length;i++){
        let team1 = tournament[i].team1;
        let team2 = tournament[i].team2;
        createTeamsArrHelper(team1,teamsArr);
        createTeamsArrHelper(team2,teamsArr);
    }
    return teamsArr;
}

function createTeamsArrHelper(teamName,teamsArr){
    for(let i=0;i<teamsArr.length;i++){
        if(teamsArr[i].name == teamName){
            return;
        }
    }
    
    let data = {
        name:teamName,
        matches : []
    }
    teamsArr.push(data);
}

function fillMatchesInTeamsArr(tournament,teamsArr){
    
    for(let i=0;i<tournament.length;i++){
        
        let team1 = tournament[i].team1;
        let team2 = tournament[i].team2;

        for(let j=0;j<teamsArr.length;j++){
            
            if(teamsArr[j].name == team1){
                let data = {
                    matchNo:tournament[i].matchNo,
                    vs:tournament[i].team2,
                    selfScore:tournament[i].score1,
                    oppScore: tournament[i].score2,
                    result:tournament[i].result
                }
                
                teamsArr[j].matches.push(data);
            }

            if(teamsArr[j].name == team2){
                let data = {
                    matchNo:tournament[i].matchNo,
                    vs:tournament[i].team1,
                    selfScore:tournament[i].score2,
                    oppScore: tournament[i].score1,
                    result:tournament[i].result
                }
                
                teamsArr[j].matches.push(data);
            }
        }
        
    }
}

function createJsonFile(teamsArr){
    let teamsArrJSON = JSON.stringify(teamsArr);
    fs.writeFile("JSON.json",teamsArrJSON,"utf-8",function(err){
        if(err) console.log("Issue creating Json file");
    })
}

function createExcelFile(teamsArr){
    let wb = new excel.Workbook();  // create workbook

    const bghead = wb.createStyle({
        font: {
            color: '#FFFFFF',
            size: 12,
            bold:true
        },
        fill: {
          type: 'pattern',
          patternType: 'solid',
          bgColor: '#bd0606',
          fgColor: '#bd0606',
        }
    });

    const bgCell = wb.createStyle({
          fill:{
              type: 'pattern',
              patternType: 'solid',
              bgColor: '#ffffff',
              fgColor: '#ffffff'
          }
    })

    for(let i=0;i<teamsArr.length;i++){
        let ws = wb.addWorksheet(teamsArr[i].name);  // create worksheet
        ws.cell(1,1).string("MATCH").style(bghead);
        ws.cell(1,2).string("VS").style(bghead);
        ws.cell(1,3).string("OPP SCORE").style(bghead);
        ws.cell(1,4).string("SELF SCORE").style(bghead);
        ws.cell(1,5).string("RESULT").style(bghead);

        for(let j=0;j<teamsArr[i].matches.length;j++){
            ws.cell(2+j,1).number(parseInt(teamsArr[i].matches[j].matchNo)).style(bgCell);
            ws.cell(2+j,2).string(teamsArr[i].matches[j].vs).style(bgCell);
            ws.cell(2+j,3).string(teamsArr[i].matches[j].selfScore).style(bgCell);
            ws.cell(2+j,4).string(teamsArr[i].matches[j].oppScore).style(bgCell);
            ws.cell(2+j,5).string(teamsArr[i].matches[j].result).style(bgCell);
            ws.cell(2+j,6).style(bgCell);
            ws.cell(2+j,7).style(bgCell);
            ws.cell(2+j,8).style(bgCell);
            ws.cell(2+j,9).style(bgCell);
        }
    }
    
    wb.write('Excel.xlsx'); 

}

function createQrCodes(tournament){

    fs.mkdir("QRCodes",{ recursive: true },function(err){
        if(err) console.log("Error occured");
        else{
            for(let i=0;i<tournament.length;i++){
                let filename = path.join("QRCodes","Match "+tournament[i].matchNo+".png");
                let dataString = "Match: "+tournament[i].matchNo +"\nTeam: "+tournament[i].team1+" VS "+tournament[i].team2 +"\nScores: "+tournament[i].score1 +" VS "+tournament[i].score2 +"\nResult: "+tournament[i].result;
                QRCode.toFile(filename, dataString, function (err) {
                    if (err) throw err
                })   
            }   
        }
    })


    
}

function createFolderAndPdf(teamsArr){

    fs.mkdir("PDFs",{recursive:true},function(err){
        if(err) console.log("Error occured while creating Pdfs folder");
        else{
            for(let i=0;i<teamsArr.length;i++){
                let folderName = path.join("PDFs",teamsArr[i].name);
                fs.mkdir(folderName,{recursive:true},function(err){
                    if(err) console.log("Error ocured while creating teams folder");
                    else{
                        for(let j=0;j<teamsArr[i].matches.length; j++){
                            let teamName = teamsArr[i].name;
                            let match = teamsArr[i].matches[j];
                            createPdfs(teamName,match);
                        }
                    }
                })
            }
        }
    })
    console.log("Done..");  
}

async function createPdfs(teamName,matchDetails){
    
    let filePath = path.join("PDFs",teamName,matchDetails.vs+".pdf");
    
    let templateBytes = fs.readFileSync('template.pdf');
    let pdfDoc = await pdf.PDFDocument.load(templateBytes);
    let page = pdfDoc.getPages()[0];

    let vs = matchDetails.vs;
    vs = vs.toUpperCase();
    teamName = teamName.toUpperCase();
    let s1 = matchDetails.selfScore;
    let s2 = matchDetails.oppScore;
    let res = matchDetails.result;
    let matchNo = matchDetails.matchNo+"";
    
    page.drawText(matchNo, {
        x: 108,
        y: 418,
        size: 22,
        color: pdf.rgb(0.99,0.99,0.99)
    }) 

    page.drawText(teamName, {
        x: 155,
        y: 355,
        size: 20,
        color: pdf.rgb(0.999,0.999,0.999)
    }) 

    page.drawText(vs, {
        x: 440,
        y: 355,
        size: 20,
        color: pdf.rgb(0.9,0.9,0.9)
    })

    page.drawText(s1, {
        x: 200,
        y: 230,
        size: 24
    })

    page.drawText(s2, {
        x: 440,
        y: 230,
        size: 24
    })

    page.drawText(res, {
        x: 170,
        y: 115,
        size: 21
    })

    let qrPath = path.join(__dirname,"QRCodes","Match "+matchNo+".png");
    fs.readFile(qrPath,async function(err,qrBytes){
        if(err) console.log("Error reading QR Code");
        else{
            const QR = await pdfDoc.embedPng(qrBytes);
            page.drawImage(QR, {
                x: 630,
                y: 250,
                width: 85,
                height: 85,
            })
            let pdfBytes = await pdfDoc.save();

            fs.writeFileSync(filePath,pdfBytes);
        } 
    })
    
}

