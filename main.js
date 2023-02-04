import fs       from 'fs';
import fetch    from 'node-fetch';
import open     from 'open';
import {escape} from 'querystring';

const useStoredHome = (process.argv[2] === 'useStoredHome');

const rx_show    = new RegExp(`<li><i><a href="/wiki/.*?" title="(.*?)">`, 'sg');
const rx_series  = new RegExp(`for="_blank">.*?TV Series.*?</label>`,'isg');
const rx_dev     = new RegExp(`>In development: More at IMDbPro<`,'sg');
const rx_date    = new RegExp(`tt_ov_rdat">(\\d\\d\\d\\d)`,'sg');
const rx_proc    = new RegExp(`Procedural drama`,'sg');
const rx_genre   = new RegExp(`<span class="ipc-chip__text">(.*?)</span>`,'sg');

const oldShows = JSON.parse(fs.readFileSync("oldShows.json"));
const oldLinks = JSON.parse(fs.readFileSync("oldLinks.json"));

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
    const title = titleTVseries.replace(/ \(.*?TV series\)/i, '');

    // console.log(title);
    if(title in oldShows) continue;

    oldShows[title] = true;
    fs.writeFileSync("oldShows.json", JSON.stringify(oldShows));

    console.log(`\n--- ${title} ---`);
    

///////////////////////  SEARCH  /////////////////////

    const searchUrl = 
      `https://www.imdb.com/find/?q=${escape(title)}&ref_=nv_sr_sm`;
    
    // console.log('fetching imdb search results page');
    const searchResData = await fetch(searchUrl);
    const searchResHtml = await searchResData.text();

    fs.writeFileSync('searchResHtml.html', searchResHtml);


///////////////////////  LINKS  /////////////////////

    const escTitle = title.replace(/&/g, "&amp;")
                          .replace(/'/g, "&#x27;");
    const rx_relLink = 
        new RegExp(`href="(/title/tt[^"]*)">${escTitle}</a>`,'sg');

    const links = [];
    rx_relLink.lastIndex = 0;
    let relLinkGroups;
    while((relLinkGroups = rx_relLink.exec(searchResHtml)) !== null) {
      const relLink = relLinkGroups[1];
      const linkIdx = rx_relLink.lastIndex;
      links.push({linkIdx, relLink});
    }

    if(links.length == 0) {
        console.log('skipping title, no link\n' + searchUrl);
        return;
        continue;
    }
    // console.log(links);

linkloop:
    for(let linkIdx = 0; linkIdx < links.length; linkIdx++) {
      const linkData = links[linkIdx];
      const relLink = linkData.relLink;
      if(relLink in oldLinks) continue;

      oldLinks[relLink] = true;
      fs.writeFileSync("oldLinks.json", JSON.stringify(oldLinks));


///////////////////////  SEARCH PAGE FILTER  /////////////////////

      rx_series.lastIndex = linkData.linkIdx;
      const seriesGroups = rx_series.exec(searchResHtml);
      if(!seriesGroups) {
        console.log('skipping link, not a tv series (off end)');
        continue;
      }
      const seriesIdx = rx_series.lastIndex;
      const nextLinkIdx = 
              (linkIdx < links.length-1 ? links[linkIdx+1].linkIdx : 1e9);
      if(seriesIdx >= nextLinkIdx) {
        console.log('skipping link, not a tv-series (none before next)');
        continue;
      }


///////////////////////  DETAIL PAGE FILTERS  /////////////////////

      const detailUrl = 'https://www.imdb.com' + relLink;
      // console.log('fetching detailed series page:', detailUrl);
      const detailResData = await fetch(detailUrl);
      const detailHtml    = await detailResData.text();
      
      fs.writeFileSync('detailHtml.html', detailHtml);

      if(rx_dev.test(detailHtml)) {
        console.log('skipping link, in development');
        continue;
      }

      if(rx_proc.test(detailHtml)) {
        console.log('skipping link, procedural');
        continue;
      }

      const dateGroups = rx_date.exec(detailHtml);
      if(dateGroups) {
        const dateTxt = dateGroups[1];
        // console.log({dateTxt});
        if(dateTxt < '2000') {
          console.log(`skipping link, date ${dateTxt} is too old`);
          continue;
        }
      }
      else {
        fs.writeFileSync('detailHtml.html', detailHtml);
        console.log('skipping link, no date'+ '\n');
        // continue;
        return;
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
            genre.includes('garden')              ||
            genre.includes('lgbtq')               ||
            genre.includes('musical')             ||
            genre.includes('reality')             ||
            genre.includes('sport')               ||
            genre.includes('stand-up')            ||
            genre.includes('talk')                ||
            genre.includes('travel')) {
          console.log('skipping link,', genre);
          continue linkloop;
        }
      }

      const wikiUrl = 
        `https://en.wikipedia.org/wiki/${titleTVseries.replace(/ /g, '_')}`;

      fs.writeFileSync("links.txt", 'run useStoredHome\n\n');
      fs.appendFileSync("links.txt", wikiUrl+'\n');
      fs.appendFileSync("links.txt", searchUrl+'\n');

      console.log('opening page in browser');
      open(detailUrl);
      return;

    } // end link loop

    console.log('skipping title, all links failed');

  } // end show loop
  
})()

function unEscape(htmlStr) {
  htmlStr = htmlStr.replace(/&lt;/g,  '<');	 
  htmlStr = htmlStr.replace(/&gt;/g,  '>');     
  htmlStr = htmlStr.replace(/&quot;/g,'"');  
  htmlStr = htmlStr.replace(/&#39;/g, "'");   
  htmlStr = htmlStr.replace(/&amp;/g, '&');
  return htmlStr;
}
