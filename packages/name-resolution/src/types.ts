import { ENSOptions } from "./ens/types";
import { SIDOptions } from "./sid/types";

export type CoinType =
  | "BTC"
  | "LTC"
  | "DOGE"
  | "RDD"
  | "DASH"
  | "PPC"
  | "NMC"
  | "VIA"
  | "GRS"
  | "DGB"
  | "MONA"
  | "DCR"
  | "XEM"
  | "AIB"
  | "SYS"
  | "ETH"
  | "ETC_LEGACY"
  | "ICX"
  | "XVG"
  | "STRAT"
  | "ARK"
  | "ATOM"
  | "ZIL"
  | "EGLD"
  | "ZEN"
  | "XMR"
  | "ZEC"
  | "LSK"
  | "STEEM"
  | "FIRO"
  | "RSK"
  | "KMD"
  | "XRP"
  | "BCH"
  | "XLM"
  | "BTM"
  | "BTG"
  | "NANO"
  | "RVN"
  | "POA_LEGACY"
  | "LCC"
  | "EOS"
  | "TRX"
  | "BCN"
  | "FIO"
  | "BSV"
  | "NEO"
  | "NIM"
  | "EWT_LEGACY"
  | "ALGO"
  | "IOST"
  | "DIVI"
  | "IOTX"
  | "BTS"
  | "CKB"
  | "MRX"
  | "LUNA"
  | "DOT"
  | "VSYS"
  | "ABBC"
  | "NEAR"
  | "ETN"
  | "AION"
  | "KSM"
  | "AE"
  | "KAVA"
  | "FIL"
  | "AR"
  | "CCA"
  | "THETA_LEGACY"
  | "SOL"
  | "XHV"
  | "FLOW"
  | "IRIS"
  | "LRG"
  | "SERO"
  | "BDX"
  | "CCXX"
  | "SRM"
  | "VLX"
  | "BPS"
  | "TFUEL"
  | "GRIN"
  | "XDAI_LEGACY"
  | "VET"
  | "BNB"
  | "CLO_LEGACY"
  | "HIVE"
  | "TOMO_LEGACY"
  | "HNT"
  | "RUNE"
  | "BCD"
  | "TT_LEGACY"
  | "FTM_LEGACY"
  | "ONE"
  | "ONT"
  | "XTZ"
  | "ADA"
  | "SC"
  | "QTUM"
  | "GXC"
  | "ELA"
  | "NAS"
  | "HBAR"
  | "IOTA"
  | "HNS"
  | "STX"
  | "GO_LEGACY"
  | "XCH"
  | "NULS"
  | "AVAX"
  | "NRG_LEGACY"
  | "ARDR"
  | "ZEL"
  | "CELO_LEGACY"
  | "WICC"
  | "WAN"
  | "WAVES"
  | "OP"
  | "CRO"
  | "BSC"
  | "GO"
  | "ETC"
  | "TOMO"
  | "POA"
  | "XDAI"
  | "TT"
  | "MATIC"
  | "EWT"
  | "FTM"
  | "THETA"
  | "CLO"
  | "NRG"
  | "ARB1"
  | "CELO"
  | "AVAXC";

export abstract class BaseResolver {
  name: string;

  public abstract init(): Promise<void>;

  public abstract resolveAddress(
    name: string,
    coint: CoinType
  ): Promise<string | null>;

  public abstract resolveReverseName(address: string): Promise<string | null>;

  public abstract isSupportedName(name: string): boolean;
}

export interface NameResolverOptions {
  ens: ENSOptions;
  sid: SIDOptions;
}
