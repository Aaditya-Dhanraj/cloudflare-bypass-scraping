const express = require('express');
const app = express();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Allow all origins to access this API
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cache-Control', 'public, max-age=0');
  next();
});

// Fetch the HTML for a Quizlet set
const getQuizletSet = async () => {
  url = 'https://quizlet.com/183572466/test?answerTermSides=2&promptTermSides=6&questionCount=2000&questionTypes=15&showImages=true';
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,2700',
      '--lang=en-US,en;q=0.9'
    ]
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  await page.waitForSelector('script[id=__NEXT_DATA__]');

  let raw = await page.$eval('script[id=__NEXT_DATA__]', el => el.textContent);
  let parsed = JSON.parse(raw); // check this or dehydratedReduxStateKey below if you need anything more from the page
  parsed = parsed.props.pageProps;

  let result = null;

  try {
    const { setTitle, canonicalUrl, socialImageUrl, dehydratedReduxStateKey, ...studyModeData } = JSON.parse(raw).props.pageProps;
    // const doc = Object.values(JSON.parse(studyModeData).studyModeData.studiableDocumentData.studiableItems);
    const doc = studyModeData.studyModeData.studiableDocumentData.studiableItems;
    const options = studyModeData.studyModeData.studiableDocumentData?.studiableMetadataByType[4];

    const questionsAnswers = [];

    doc.map((el, firstKey)=>{
      const rank = el.rank;
      const getOptions = options.find(id => id.studiableItemId === el.id)?.distractors;

      if(el.cardSides) {
        const questionAnswer = {
          question_no: rank,
          url,
        }

        const option = [];

        if(getOptions) {
          getOptions.map((el)=> {
            option.push(el.media[0].plainText);
            // console.log(el, '#################');
          })
        }
        questionAnswer.options = option ? option : {};

        el.cardSides.map((side, key)=>{
            side.media.map((sl)=>{
              if(key === 1) {
                  if(sl.url) {
                    questionAnswer.url = sl.url ? sl.url : '';
                  }
                  if(sl.plainText) {
                    questionAnswer.Question = sl.plainText ? sl.plainText : '';
                  }
              }
              if(key === 0) {
                  questionAnswer.Answer = sl.plainText ? sl.plainText : '';
              }
            })
        });
        questionsAnswers.push(questionAnswer);
      }
    });

    console.log(questionsAnswers, '@@@@@@@@@@@@@@@@@@@@@@@@@@@@');


    return questionsAnswers;

    // const cards = terms.map(({
    //   word: front,
    //   _wordAudioUrl: frontAudio,
    //   definition: back,
    //   _definitionAudioUrl: backAudio,
    //   _imageUrl: image
    // }) => ({
    //   front,
    //   frontAudio,
    //   back: back.replace(/[\r\n]/gm, ''),  // remove line breaks
    //   backAudio,
    //   image
    // }));

    // result = ({ url: canonicalUrl, socialImg: socialImageUrl, title: setTitle, cards: cards });

  } catch (error) {
    console.error(error);
  }

  browser.close();
  return result;
};

// Define a route to handle Quizlet set requests
app.get('/quizlet-set/:setId', async (req, res) => {
  const setId = req.params.setId;
  const url = `https://quizlet.com/${setId}`;
  try {
    const data = await getQuizletSet(url);
    res.setHeader('Cache-Control', 'public, max-age=0');
    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
});

// Start the server
const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});