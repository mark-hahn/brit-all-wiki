import fs       from 'fs';
import fetch    from 'node-fetch';
import open     from 'open';
import {escape} from 'querystring';

const useStoredHome = (process.argv[2] === 'useStoredHome');

const rx_show   = new RegExp(`<li><i><a href="/wiki/.*?" title="(.*?)">`, 'sg');
const rx_series = new RegExp(`for="_blank">.*?TV Series.*?</label>`,'isg');
const rx_dev    = new RegExp(`>In development: More at IMDbPro<`,'sg');
const rx_date   = new RegExp(`tt_ov_rdat">(\\d\\d\\d\\d).*?<`,'sg');
const rx_proc   = new RegExp(`Procedural drama`,'sg');

// /releaseinfo?ref_=tt_ov_rdat">2012–2018<

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

    const rx_relLink = 
        new RegExp(`href="(/title/tt[^"]*)">${title}</a>`,'sg');

    const linkSearchUrl = 
      `https://www.imdb.com/find/?q=${escape(title)}&ref_=nv_sr_sm`;
    
    // console.log('fetching imdb search results page');
    const imdbSrchResData = await fetch(linkSearchUrl);
    const imdbSrchResHtml = await imdbSrchResData.text();

    // fs.writeFileSync('imdbSrchResHtml.html', imdbSrchResHtml);

    const links = [];
    rx_relLink.lastIndex = 0;
    let relLinkGroups;
    while((relLinkGroups = rx_relLink.exec(imdbSrchResHtml)) !== null) {
      const relLink = relLinkGroups[1];
      const linkIdx = rx_relLink.lastIndex;
      links.push({linkIdx, relLink});
    }
    if(links.length == 0) {
        console.log('skipping, no detail link\n' + linkSearchUrl);
        continue;
    }
    // console.log(links);

    for(let linkIdx = 0; linkIdx < links.length; linkIdx++) {
      const linkData = links[linkIdx];
      const relLink = linkData.relLink;
      if(relLink in oldLinks) continue;

      oldLinks[relLink] = true;
      fs.writeFileSync("oldLinks.json", JSON.stringify(oldLinks));

      rx_series.lastIndex = linkData.linkIdx;
      const linkGroups = rx_series.exec(imdbSrchResHtml);
      if(!linkGroups) {
        console.log('skipping, not a tv series\n' + linkSearchUrl);
        continue;
      }

      const seriesIdx = rx_series.lastIndex;
      const nextLinkIdx = 
              (linkIdx < links.length-1 ? links[linkIdx+1].linkIdx : 1e9);
      if(seriesIdx >= nextLinkIdx) {
        console.log('skipping detail link, not a tv-series');
        continue;
      }

      const detailUrl = 'https://www.imdb.com' + relLink;
      // console.log('fetching imdb detailed series page:', detailUrl);
      const imdbDetailResData = await fetch(detailUrl);
      const imdbDetailHtml    = await imdbDetailResData.text();
      
      if(rx_dev.test(imdbDetailHtml)) {
        console.log('skipping link, in development');
        continue;
      }

      if(rx_proc.test(imdbDetailHtml)) {
        console.log('skipping link, procedural');
        continue;
      }
      
      // fs.writeFileSync('imdbDetailHtml.html', imdbDetailHtml);
      
      const dateGroups = rx_date.exec(imdbDetailHtml);
      if(dateGroups) {
        const dateTxt = dateGroups[1];
        // console.log({dateTxt});
        if(dateTxt < '2000') {
          console.log(`skipping link, date ${dateTxt} is too old`);
          continue;
        }
      }
      else {
        console.log('skipping link, no date');
        continue;
      }

      console.log('opening page in browser');
      open(detailUrl);
      return;

    } // end link loop

    console.log('skipping title, all links failed');

    // return;

    // let wikiData;
    // try {
    //   wikiData = await fetch(showUrl);
    // }
    // catch(e) {
    //   console.log(e.message + '\n\n');
    //   process.exit();
    // }

    // const showHtml = await wikiData.text();
    // let genreMatches;
    // rx_genre.lastIndex = 0;
    // while((genreMatches = rx_genre.exec(showHtml)) !== null) {
    //   const genre = genreMatches[1];
    //   if( genre === 'Anime'               ||
    //       genre === 'Biography'           ||
    //       genre === 'Children'            ||
    //       genre === 'Documentary'         ||
    //       genre === 'Family'              ||
    //       genre === 'Food'                ||
    //       genre === 'Game Show'           ||
    //       genre === 'History'             ||
    //       genre === 'Home &amp; Garden'   ||
    //       genre === 'LGBTQ'               ||
    //       genre === 'Musical'             ||
    //       genre === 'Reality'             ||
    //       genre === 'Sport'               ||
    //       genre === 'Stand-up &amp; Talk' ||
    //       genre === 'Travel') {
    //     console.log('---- skipping', genre);
    //     continue showLoop;
    //   }
    // }

    const wikiUrl = 
      `https://en.wikipedia.org/wiki/${titleTVseries.replace(/ /g, '_')}`;

    fs.writeFileSync("links.txt", 'run useStoredHome\n\n');
    fs.appendFileSync("links.txt", wikiUrl+'\n');
    fs.appendFileSync("links.txt", linkSearchUrl+'\n');

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
