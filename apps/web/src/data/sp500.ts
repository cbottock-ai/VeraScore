// S&P 500 constituent tickers (as of Q1 2026)
// Used to filter earnings calendar to relevant large-cap companies
export const SP500_TICKERS = new Set([
  'MMM','AOS','ABT','ABBV','ACN','ADBE','AMD','AES','AFL','A','APD','ABNB',
  'AKAM','ALB','ARE','ALGN','ALLE','LNT','ALL','GOOGL','GOOG','MO','AMZN',
  'AMCR','AEE','AAL','AEP','AXP','AIG','AMT','AWK','AMP','AME','AMGN','APH',
  'ADI','ANSS','AON','APA','AAPL','AMAT','APTV','ACGL','ADM','ANET','AJG',
  'AIZ','T','ATO','ADSK','ADP','AZO','AVB','AVY','AXON','BKR','BALL','BAC',
  'BA','BKNG','BWA','BSX','BMY','AVGO','BR','BRO','BF.B','BLDR','BG','CDNS',
  'CZR','CPT','CPB','COF','CAH','KMX','CCL','CARR','CTLT','CAT','CBOE','CBRE',
  'CDW','CE','COR','CNC','CNX','CDAY','CF','CRL','SCHW','CHTR','CVX','CMG',
  'CB','CHD','CI','CINF','CTAS','CSCO','C','CFG','CLX','CME','CMS','KO',
  'CTSH','CL','CMCSA','CAG','COP','ED','STZ','CEG','COO','CPRT','GLW','CPAY',
  'CTVA','CSGP','COST','CTRA','CCI','CSX','CMI','CVS','DHR','DRI','DVA','DAY',
  'DE','DAL','DVN','DXCM','FANG','DLR','DFS','DG','DLTR','D','DPZ','DOV',
  'DOW','DHI','DTE','DUK','DD','EMN','ETN','EBAY','ECL','EIX','EW','EA',
  'ELV','LLY','EMR','ENPH','ETR','EOG','EPAM','EQT','EFX','EQIX','EQR',
  'ESS','EL','ETSY','EG','EVRG','ES','EXC','EXPE','EXPD','EXR','XOM','FFIV',
  'FDS','FICO','FAST','FRT','FDX','FIS','FITB','FSLR','FE','FI','FMC','F',
  'FTNT','FTV','FOXA','FOX','BEN','FCX','GRMN','IT','GE','GEHC','GEV','GEN',
  'GNRC','GD','GIS','GM','GPC','GILD','GS','HAL','HIG','HAS','HCA','DOC',
  'HSIC','HSY','HES','HPE','HLT','HOLX','HD','HON','HRL','HST','HWM','HPQ',
  'HUBB','HUM','HBAN','HII','IBM','IEX','IDXX','ITW','INCY','IR','PODD',
  'INTC','ICE','IFF','IP','IPG','INTU','ISRG','IVZ','INVH','IQV','IRM',
  'JBHT','JBL','JKHY','J','JNJ','JCI','JPM','JNPR','K','KVUE','KDP','KEY',
  'KEYS','KMB','KIM','KMI','KLAC','KHC','KR','LHX','LH','LRCX','LW','LVS',
  'LDOS','LEN','LII','LIN','LYV','LKQ','LMT','L','LOW','LULU','LYB','MTB',
  'MRO','MPC','MKTX','MAR','MMC','MLM','MAS','MA','MTCH','MKC','MCD','MCK',
  'MDT','MRK','META','MET','MTD','MGM','MCHP','MU','MSFT','MAA','MRNA','MHK',
  'MOH','TAP','MDLZ','MPWR','MNST','MCO','MS','MOS','MSI','MSCI','NDAQ',
  'NTAP','NFLX','NEM','NWSA','NWS','NEE','NKE','NI','NDSN','NSC','NTRS',
  'NOC','NCLH','NRG','NUE','NVDA','NVR','NXPI','ORLY','OXY','ODFL','OMC',
  'ON','OKE','ORCL','OTIS','PCAR','PKG','PLTR','PANW','PARA','PH','PAYX',
  'PAYC','PYPL','PNR','PEP','PFE','PCG','PM','PSX','PNW','PNC','POOL','PPG',
  'PPL','PFG','PG','PGR','PRU','PLD','PRU','PEG','PTC','PSA','PHM','QRVO',
  'PWR','QCOM','DGX','RL','RJF','RTX','O','REG','REGN','RF','RSG','RMD',
  'RVTY','ROK','ROL','ROP','ROST','RCL','SPGI','CRM','SBAC','SLB','STX',
  'SRE','NOW','SHW','SPG','SWKS','SJM','SW','SNA','SOLV','SO','LUV','SWK',
  'SBUX','STT','STLD','STE','SYK','SMCI','SYF','SNPS','SYY','TMUS','TROW',
  'TTWO','TPR','TRGP','TGT','TEL','TDY','TFX','TER','TSLA','TXN','TXT','TMO',
  'TJX','TSCO','TT','TDG','TRV','TRMB','TFC','TYL','TSN','USB','UBER','UDR',
  'ULTA','UNP','UAL','UPS','URI','UNH','UHS','VLO','VTR','VLTO','VRSN',
  'VRSK','VZ','VRTX','VTRS','VICI','V','VST','VMC','WRB','GWW','WAB','WBA',
  'WMT','DIS','WBD','WM','WAT','WEC','WFC','WELL','WST','WDC','WY','WHR',
  'WMB','WTW','WYNN','XEL','XYL','YUM','ZBRA','ZBH','ZTS',
])

// Nasdaq 100 constituents (as of Q1 2026)
export const NASDAQ100_TICKERS = new Set([
  'AAPL','MSFT','NVDA','AMZN','META','TSLA','GOOGL','GOOG','AVGO','COST',
  'NFLX','AMD','TMUS','CSCO','INTC','INTU','CMCSA','PEP','AMGN','ADBE',
  'TXN','QCOM','HON','SBUX','GILD','BKNG','REGN','ADI','PANW','VRTX',
  'ISRG','LRCX','KLAC','MDLZ','SNPS','CDNS','ADP','CTAS','PYPL','ORLY',
  'FTNT','CSX','MAR','CHTR','MU','MELI','PAYX','ROST','KDP','MNST',
  'NXPI','ODFL','DXCM','PCAR','CPRT','BIIB','FAST','EXC','VRSK','IDXX',
  'ANSS','CTSH','ON','FANG','DLTR','MRVL','TTD','ROP','CSGP','ILMN',
  'TEAM','WDAY','CRWD','ZS','DDOG','GEHC','DASH','ABNB','EA','SIRI',
  'WBD','ZM','DOCU','OKTA','SPLK','MTCH','NDAQ','PLTM','CEG',
])

// Popular stocks frequently discussed that are NOT in the S&P 500
// Includes Nasdaq 100 non-S&P members, high-profile growth/tech, and notable new listings
export const POPULAR_TICKERS = new Set([
  // Fintech / crypto
  'COIN','HOOD','SOFI','AFRM','UPST','SQ','BILL','SMAR',
  // Cloud / SaaS (non-S&P)
  'SNOW','DDOG','ZS','NET','MDB','DOCU','TWLO','GTLB','ESTC','PATH',
  'OKTA','HUBS','DOCN','CFLT','SAMSARA','S','IOT','WK','BRZE',
  // E-commerce / consumer
  'SHOP','CHWY','W','WISH','RBLX','SNAP','PINS','BMBL','MTTR',
  // EV / clean energy
  'RIVN','LCID','NKLA','FSR','XPEV','LI','NIO','GOEV',
  'JOBY','ACHR','LILM','BLNK','CHPT','BE','STEM',
  // Nuclear / defense tech
  'OKLO','SMR','NNE','BWXT','VNET',
  // AI / robotics
  'AI','SOUN','BBAI','IONQ','QUBT','RGTI','ARQQ','RXRX','DNLI',
  // Other high-profile names
  'LYFT','DASH','ABNB','U','ROKU','SPOT','DUOL','MSTR',
  'SPCE','OPEN','LMND','AGILON','CLOV','PAYO','BIRD',
  // Biotech / health (popular names)
  'BEAM','EDIT','CRSP','NTLA','FATE','KYMR','ARNA',
])
