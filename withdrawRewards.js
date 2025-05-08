const { loadChainConfig, getChainConfig } = require("./chains");

const chainKey = process.argv[2] || "";

try {
  // Load the configuration with the provided chainKey or default
  loadChainConfig(chainKey);
} catch (error) {
  console.error(`Error loading chain configuration: ${error.message}`);
  process.exit(1);
}

const CHAINNAME = getChainConfig().CHAINNAME;
const CHAINID = getChainConfig().CHAINID;

const ethers = require("ethers");
const { CONTRACTS } = require("./constants/contracts.js");
const { SIGNER } = require("./constants/providers.js");
const { ADDRESS } = require("./constants/address.js");
const { ABI } = require("./constants/abi.js");
const { Config,CONFIG } = require("./constants/config.js");
const { FetchApiPrizes } = require("./functions/fetchApiPrizes.js");
const { FetchG9ApiPrizes } = require("./functions/fetchG9ApiPrizes.js");
const { GetWinnersByTier } = require("./functions/getWinnersByTier.js");
const { GetRecentClaims } = require("./functions/getRecentClaims.js");
const { SendClaims } = require("./functions/sendClaims.js");
const chalk = require("chalk");
const { GetPrizePoolData } = require("./functions/getPrizePoolData.js");
const { GeckoIDPrices } = require("./utilities/geckoFetch.js");
const { GetPricesForToken } = require("./utilities/1inch.js");
const { CollectRewards } = require("./collectRewards.js");
const NodeCache = require("node-cache");
const nodeCache = new NodeCache();

const { minTimeInMilliseconds, maxTimeInMilliseconds, useCoinGecko,
 MINPROFIT, MINPROFITPERCENTAGE, MINTOCLAIM ,
TIERSTOCLAIM,USEAPI
//MAXWINNERS, MAXINDICES
} = Config(CHAINNAME);

const useApiPriceOverride = true;

const section = chalk.hex("#47FDFB");

async function go() {
  console.log(section("----- starting claim bot ------"));
  console.log("time logged | ", new Date().toLocaleTimeString());

  const claimsPromise = GetRecentClaims(CHAINID);
  //  const prizePoolDataPromise = GetPrizePoolData();

  // Set up the third promise based on the useCoinGecko flag
  const priceFetchPromise =
    useCoinGecko && !useApiPriceOverride
      ? GeckoIDPrices([ADDRESS[CHAINNAME].PRIZETOKEN.GECKO, "ethereum"])
      : fetch("https://poolexplorer.xyz/overview");

  // Use Promise.all to wait for all three promises to resolve
  const [claims, lastDraw /*prizePoolData*/, priceData] = await Promise.all([
    claimsPromise,
    CONTRACTS.PRIZEPOOL[CHAINNAME].getLastAwardedDrawId(),
    //prizePoolDataPromise,
    priceFetchPromise,
  ]);

  console.log("got " + claims.length + " claim events ", "\n");



  let prizeTokenPrice, ethPrice;

  // If useCoinGecko is true, priceData is from GeckoIDPrices, otherwise it's the direct prize token price
  if (useCoinGecko && !useApiPriceOverride) {
    prizeTokenPrice = priceData[0];
    ethPrice = priceData[1];
  } else {
    const priceResponse = await priceData.json();
    prizeTokenPrice = priceResponse.prices.geckos["ethereum"];
    ethPrice = prizeTokenPrice;
    console.log("got price from api", prizeTokenPrice);
  }


  await CollectRewards(prizeTokenPrice, ethPrice);
  console.log("Execution completed at", new Date().toLocaleTimeString());
}

// Start the first execution immediately
go();
