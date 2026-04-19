export interface Listing {
  id: string;
  title: string;
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
  createdAt?: any;
}

export interface WantListing {
  id: string;
  title: string;
  targetPrice: number;
  condition?: string;
  cardType?: string;
  imageUrl?: string;
  userName: string;
  userPhoto?: string;
  createdAt?: any;
  englishName?: string;
}

export interface Product {
  id?: string;
  card_id: string;
  rank: number;
  name_zh: string;
  name_jp: string;
  card_number?: string;
  set_name: string;
  image_url: string;
  psa10_hkd?: number;
  updated_at?: string;
  market_data: {
    snkrdunk_price: number;
    ebay_price: number;
    raw_price?: number;
    psa10_price?: number;
    change_24h: string;
    status: string;
  };
}

export interface PokemonCard {
  cardID: string;
  cardThumbFile: string;
  cardNameAltText: string;
  cardNameViewText: string;
}

export interface PortfolioItem {}
