export interface Listing {
  id: string;
  title: string;
  seriesCode?: string;
  cardNumber?: string;
  description: string;
  price: number;
  condition: string;
  cardType?: string;
  imageUrl: string;
  imageUrls?: string[];
  sellerName: string;
  sellerPhoto?: string;
  sellerRating?: number;
  englishName?: string;
  status?: string;
  tags?: string[];
  createdAt?: any;
}

export interface WantListing {
  id: string;
  title: string;
  cardNumber?: string;
  targetPrice: number;
  condition?: string;
  cardType?: string;
  imageUrl?: string;
  imageUrls?: string[];
  userName: string;
  userPhoto?: string;
  createdAt?: any;
  englishName?: string;
  tags?: string[];
}

export interface Product {
  id?: string;
  card_id: string;
  rank: number;
  name?: string;
  name_zh: string;
  name_hk?: string;
  name_jp: string;
  card_number?: string;
  set_name: string;
  image_url: string;
  imageUrl?: string;
  psa10_hkd?: number;
  market_data: {
    snkrdunk_price: number;
    ebay_price: number;
    change_24h: string;
    status: string;
    psa10_price?: number;
    raw_price?: number;
    snkdunk_price?: number;
    psa_pop_total?: number;
    psa_pop_10?: number;
    psa_pop_10_percent?: string;
  };
  analysis_quote?: string;
  investment_metrics?: {
    growth_potential?: number; // 0-100
    holding_advice?: string;
    holding_score?: number; // 0-100
  };
  updatedAt?: string | any;
}

export interface PokemonCard {
  cardID: string;
  cardThumbFile: string;
  cardNameAltText: string;
  cardNameViewText: string;
}

export interface PortfolioItem {}
