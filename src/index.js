const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');

async function scrapeProductInfo(url, region) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(url);

    await page.click(
      '.UiHeaderHorizontalBase_region__2ODCG > .Region_region__6OUBn',
    );

    await page.waitForSelector('.UiRegionListBase_list__cH0fK > li');

    const listRegionsText = await page.evaluate(() => {
      const regionElements = document.querySelectorAll(
        '.UiRegionListBase_list__cH0fK > li',
      );
      return Array.from(regionElements, element => element.textContent.trim());
    });

    const selectedIndex = listRegionsText.findIndex(text => text === region);

    if (selectedIndex !== -1) {
      const regionElements = await page.$$(
        '.UiRegionListBase_list__cH0fK > li',
      );
      await regionElements[selectedIndex].click();
    } else {
      console.error(`Регион не найден: ${region}`);
      return;
    }

    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForSelector('.UiFooterBottomBase_payments__IL0P6');

    const productName = await page.$eval(
      '.Title_title__nvodu',
      el => el.innerText,
    );

    const nowReg = await page.$eval(
      '.Region_region__6OUBn span:last-child',
      el => el.innerText,
    );

    const priceElement = await page.$(
      '.PriceInfo_root__GX9Xp > .Price_price__QzA8L',
    );
    const price = priceElement
      ? await page.evaluate(
          el => el.textContent.trim().split(' ')[0],
          priceElement,
        )
      : null;
    const priceOldElement = await page.$(
      '.PriceInfo_root__GX9Xp > .PriceInfo_oldPrice__IW3mC',
    );
    const priceOld = priceOldElement
      ? await page.evaluate(
          el => el.textContent.trim().split(' ')[0],
          priceOldElement,
        )
      : null;

    const rating = await page.evaluate(() => {
      const str = document
        .querySelector('div[itemprop="ratingValue"]')
        .textContent.trim();
      return str;
    });

    const reviewCount = await page.evaluate(() => {
      const str = document
        .querySelector(
          '.Summary_reviewsContainerTablet__G31JM :last-child > .Summary_title__lRoWU',
        )
        .textContent.trim()
        .replace(/\D/g, '');
      return str;
    });

    // Создаем каталог для данных и скриншотов
    const regionDirectory = path.join(
      __dirname,
      '..',
      'data',
      nowReg.replace(/\s/g, '_'),
    );
    await fs.mkdir(regionDirectory, { recursive: true });

    // Записываем данные в файл
    const dataFileName = `product_${region.replace(/\s/g, '_')}.txt`;
    const dataFilePath = path.join(regionDirectory, dataFileName);

    const dataContent = `productName: ${productName}\nregion: ${nowReg}\nprice: ${price}\npriceOld: ${priceOld}\nrating: ${rating}\nreviewCount: ${reviewCount}\n\n`;

    await fs.writeFile(dataFilePath, dataContent, { flag: 'a' });

    // Записываем скриншот
    const screenshotFileName = `screenshot_${Date.now()}.jpg`;
    const screenshotPath = path.join(regionDirectory, screenshotFileName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (error) {
    console.error('Ошибка при сборе информации', error);
  } finally {
    await browser.close();
  }
}

// Получить аргументы командной строки
const args = process.argv.slice(2);
const url = args[0];
const region = args[1];

// Проверить наличие аргументов
if (!url || !region) {
  console.error('Usage: node index.js <url> <region>');
  process.exit(1);
}

// Вызвать функцию сбора информации
scrapeProductInfo(url, region);
