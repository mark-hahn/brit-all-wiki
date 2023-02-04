import fs       from 'fs';
import fetch    from 'node-fetch';
import open     from 'open';
import {escape} from 'querystring';

const useStoredHome = (process.argv[2] === 'useStoredHome');
const dbg           = (process.argv[2] === 'debug');

const rx_show    = new RegExp(`<li><i><a href="/wiki/.*?" title="(.*?)">`, 'sg');
const rx_dev     = new RegExp(`>In development: More at IMDbPro<`,'sg');
const rx_date    = new RegExp(`tt_ov_rdat">(\\d\\d\\d\\d)`,'sg');
const rx_genre   = new RegExp(`<span class="ipc-chip__text">(.*?)</span>`,'sg');

const oldShows = JSON.parse(fs.readFileSync("oldShows.json"));

const homeUrl = 
      "https://en.wikipedia.org/wiki/List_of_British_television_programmes";

let homeHtml;
if(!useStoredHome) {
  console.log('fetching a fresh wiki page');
  const homeData = await fetch(homeUrl);
  homeHtml = await homeData.text();
  fs.writeFileSync("home.html", homeHtml);
}
else {
  console.log('using stored wiki home page');
  homeHtml = fs.readFileSync("home.html");
}


///////////////////////  SHOWS  /////////////////////

(async () => {
  let show;
  rx_show.lastIndex = 0;
  while((show = rx_show.exec(homeHtml)) !== null) {

    const titleTVseries = unEscape(show[1]);
    const title = titleTVseries.replace(/ \(.*?\)$/i, '');

    if(title in oldShows) continue;

    oldShows[title] = true;
    if(!dbg) fs.writeFileSync("oldShows.json", JSON.stringify(oldShows));

    console.log(`\n--- ${title} ---`);
    

///////////////////////  SEARCH  /////////////////////

    const searchUrl = 
      `https://www.imdb.com/find/?q=${escape(title)}&ref_=nv_sr_sm`;
    
    const searchResData = await fetch(searchUrl);
    const searchHtml    = await searchResData.text();

    if(dbg) fs.writeFileSync('dbg-search.html', searchHtml);


///////////////////////  LINKS  /////////////////////

    const escTitle = title.replace(/&/g, "&amp;")
                          .replace(/'/g, "&#x27;")
                          .replace(/\?/g, "\\?")
                          .replace(/\*/g, "\\*")
                          .replace(/\./g, "\\.")
                          .replace(/\(/g, "\\(")
                          .replace(/\)/g, "\\)")
                          .replace(/\\/g, "\\");

    const srchStr = `href="(/title/tt[^"]*)">${escTitle}</a>`;
    const rx_relLink = new RegExp(srchStr,'isg');

    const links = [];
    rx_relLink.lastIndex = 0;
    let relLinkGroups;
    while((relLinkGroups = rx_relLink.exec(searchHtml)) !== null) {
      const relLink = relLinkGroups[1];
      const linkIdx = rx_relLink.lastIndex;
      links.push({linkIdx, relLink});
    }

    if(links.length == 0) {
      console.log('skipping title, no search match');
      if(dbg) {
        console.log(srchStr);
        return;
      }
      continue;
    }

linkloop:
    for(let linkIdx = 0; linkIdx < links.length; linkIdx++) {
      const linkData = links[linkIdx];
      const relLink  = linkData.relLink;

///////////////////////  FILTERS  /////////////////////

      const detailUrl = 'https://www.imdb.com' + relLink;
      const detailResData = await fetch(detailUrl);
      const detailHtml    = await detailResData.text();
      
      fs.writeFileSync('dbg-detail.html', detailHtml);

      if(!/tv series/igs.test(detailHtml) &&
         !/tv mini series/igs.test(detailHtml)) {
        console.log('skipping link, not a series');
        if(dbg) {
          console.log(detailUrl);
          return;
        }
        continue;
      }

      if(rx_dev.test(detailHtml)) {
        console.log('skipping link, in development');
        continue;
      }

      if(/procedural/gsi.test(detailHtml)) {
        console.log('skipping link, procedural');
        continue;
      }

      rx_date.lastIndex = 0;
      const dateGroups = rx_date.exec(detailHtml);
      if(dateGroups) {
        const dateTxt = dateGroups[1];
        if(dateTxt < '2000') {
          console.log(`skipping link, date ${dateTxt} is too old`);
          continue;
        }
      }
      else {
        fs.writeFileSync('dbg-detail.html', detailHtml);
        console.log('skipping link, no date');
        if(dbg) {
          console.log(detailUrl);
          return;
        }
        continue;
      }

      rx_genre.lastIndex = 0;
      let genreGroups;
      while((genreGroups = rx_genre.exec(detailHtml)) !== null) {
        const genre = genreGroups[1].toLowerCase();
        if( genre.includes('anime')               ||
            genre.includes('biography')           ||
            genre.includes('children')            ||
            genre.includes('documentary')         ||
            genre.includes('family')              ||
            genre.includes('food')                ||
            genre.includes('game')                ||
            genre.includes('history')             ||
            genre.includes('home')                ||
            genre.includes('horror')              ||
            genre.includes('garden')              ||
            genre.includes('lgbtq')               ||
            genre.includes('musical')             ||
            genre.includes('reality')             ||
            genre.includes('sport')               ||
            genre.includes('stand-up')            ||
            genre.includes('talk')                ||
            genre.includes('travel')) {
          console.log('skipping link with genre,', genre);
          continue linkloop;
        }
      }
      console.log('opening detail page in browser');
      open(detailUrl);
      return;
    }
    if(dbg) return;
  }
})()

function unEscape(htmlStr) {
  htmlStr = htmlStr.replace(/&lt;/g,  '<');	 
  htmlStr = htmlStr.replace(/&gt;/g,  '>');     
  htmlStr = htmlStr.replace(/&quot;/g,'"');  
  htmlStr = htmlStr.replace(/&#39;/g, "'");   
  htmlStr = htmlStr.replace(/&amp;/g, '&');
  return htmlStr;
}
