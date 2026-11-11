export type MotionLevel = "none" | "subtle" | "expressive";
export type ColorMode = "light" | "dark" | "system";

export type TrustIcon =
  | "truck"
  | "refresh"
  | "shield"
  | "message"
  | "package"
  | "clock"
  | "star"
  | "heart";

export interface NavLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  /** WordPress menu slug when this column is filled from WP admin. */
  slug?: string;
  links: NavLink[];
}

export interface TrustItem {
  icon: TrustIcon;
  title: string;
  text: string;
  number?: string;
}

/** One palette mode. Values are hex or CSS colors. */
export interface ThemePalette {
  primary: string;
  accent: string;
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
}

/**
 * Design tokens live in the Next.js app (data/site.json).
 * Store identity and catalog data come from WooCommerce.
 */
export interface StoreTheme {
  font: string;
  fontDisplay: string;
  fontUrl?: string;
  radius: string;
  defaultMode: ColorMode;
  motion: MotionLevel;
  light: ThemePalette;
  dark: ThemePalette;
}

export interface SiteSeo {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  siteUrl: string;
}

export type PaymentIconSlug =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "jcb"
  | "diners"
  | "unionpay"
  | "paypal"
  | "apple-pay"
  | "google-pay"
  | "affirm"
  | "afterpay"
  | "klarna"
  | "link";

export interface GenericReview {
  reviewer: string;
  rating: number;
  title?: string;
  content: string;
  date: string;
  verified?: boolean;
  location?: string;
}

export interface ProductPageSettings {
  enableShopNow: boolean;
  shopNowLabel: string;
  shopNowEmptyCart: boolean;
  enableRatingRow: boolean;
  enableSecureBlock: boolean;
  enableAffirmMsg: boolean;
  enableAfterpayMsg: boolean;
  stripeCardBrands: PaymentIconSlug[];
  genericReviews: GenericReview[];
}

export interface ProductPaymentDisplay {
  icons: PaymentMethodIcon[];
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  affirmEnabled: boolean;
  afterpayEnabled: boolean;
}

export type CheckoutPaymentKind = "stripe" | "paypal" | "affirm" | "afterpay" | "reign";

export interface CheckoutPaymentMethod {
  kind: CheckoutPaymentKind;
  wooId: string;
  title: string;
}

export const defaultProductPage: ProductPageSettings = {
  enableShopNow: true,
  shopNowLabel: "Buy Now",
  shopNowEmptyCart: false,
  enableRatingRow: true,
  enableSecureBlock: true,
  enableAffirmMsg: true,
  enableAfterpayMsg: true,
  stripeCardBrands: [
    "visa",
    "mastercard",
    "amex",
    "unionpay",
  ],
  genericReviews: [],
};

export interface AboutValue {
  title: string;
  text: string;
}

export interface PageSectionItem {
  title: string;
  text: string;
}

export interface PageSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  items?: PageSectionItem[];
}

export interface AboutPageContent {
  eyebrow: string;
  title: string;
  intro: string;
  body: string;
  image: string;
  values: AboutValue[];
  sections?: PageSection[];
  ctaTitle?: string;
  ctaBody?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqGroup {
  title: string;
  items: FaqItem[];
}

export interface FaqPageContent {
  eyebrow: string;
  title: string;
  intro: string;
  groups: FaqGroup[];
}

export interface ContactChannel {
  title: string;
  detail: string;
  text: string;
}

export interface ContactHelpTopic {
  title: string;
  text: string;
}

export interface ContactHour {
  channel: string;
  availability: string;
}

export interface ContactPageContent {
  eyebrow: string;
  title: string;
  intro: string;
  channels?: ContactChannel[];
  businessNote?: string;
  helpTopics?: ContactHelpTopic[];
  formNote?: string;
  securityNote?: string;
  hours?: ContactHour[];
  faqs?: FaqItem[];
}

export interface CommitmentPageContent {
  eyebrow: string;
  title: string;
  intro: string;
  body: string;
  sections: PageSection[];
  ctaTitle?: string;
  ctaBody?: string;
}

export interface SitePages {
  about: AboutPageContent;
  faq: FaqPageContent;
  contact: ContactPageContent;
  commitment: CommitmentPageContent;
}

export const defaultPages: SitePages = {
  about: {
    eyebrow: "About us",
    title: "A simple place to shop well",
    intro: "",
    body: "",
    image:
      "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1200",
    values: [],
    sections: [],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions, answered",
    intro: "",
    groups: [],
  },
  contact: {
    eyebrow: "Contact",
    title: "We are here to help",
    intro: "",
  },
  commitment: {
    eyebrow: "Our commitment",
    title: "A shopping experience built around you",
    intro: "",
    body: "",
    sections: [],
  },
};

/** Design chrome from site.json; money and catalog identity come from Woo. */
export interface StoreSettings {
  id: string;
  name: string;
  tagline: string;
  logo: string;
  currency: string;
  currencySymbol: string;
  currencyPrefix: string;
  currencySuffix: string;
  priceDecimals: number;
  thousandSeparator: string;
  decimalSeparator: string;
  locale: string;
  contact: {
    email: string;
    phone: string;
    address: string;
    openingHours: string;
    legalName: string;
    vatNumber: string;
  };
  promoBanner: string;
  promoCoupon: string;
  promoId: string;
  hero: {
    headline: string;
    support: string;
  };
  navigation: {
    header: NavLink[];
    footerColumns: FooterColumn[];
  };
  footer: {
    blurb: string;
    trustLine: string;
    contactTitle?: string;
    chatLine?: string;
  };
  seo: SiteSeo;
  theme: StoreTheme;
  productPage: ProductPageSettings;
  pages: SitePages;
}

export interface ProductReview {
  id: number;
  productId: string;
  productName: string;
  productSlug: string;
  reviewer: string;
  dateCreated: string;
  rating: number;
  content: string;
  verified: boolean;
}

export interface ProductReviewsPage {
  reviews: ProductReview[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ReviewCatalogStats {
  averageRating: number;
  reviewCount: number;
}

export interface PaymentMethodIcon {
  slug: PaymentIconSlug;
  label: string;
}

export interface BnplPublicConfig {
  affirmPublicKey: string;
  affirmEnv: "sandbox" | "live";
  afterpayMpid: string;
  afterpayPlacementId: string;
}

export interface ProductCategoryRef {
  id: number;
  name: string;
  slug: string;
}

export interface ProductSpecRow {
  label: string;
  value: string;
}

export interface ProductSpecGroup {
  title: string;
  rows: ProductSpecRow[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  regularPrice: number;
  salePrice: number | null;
  onSale: boolean;
  description: string;
  sku: string;
  tags: ProductCategoryRef[];
  specGroups: ProductSpecGroup[];
  relatedIds: number[];
  images: string[];
  imageAlts: string[];
  category: string;
  categories: ProductCategoryRef[];
  featured: boolean;
  averageRating: number;
  ratingCount: number;
  menuOrder: number;
  inStock: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  imageAlt: string;
  count: number;
  parent: number;
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

export interface Address {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone: string;
}

export interface ShippingRate {
  packageId: number;
  rateId: string;
  methodId: string;
  name: string;
  price: number;
  selected: boolean;
}

export interface AppliedCoupon {
  code: string;
  discount: number;
  discountType: string;
}

export interface CartTaxLine {
  name: string;
  amount: number;
}

export interface StoreCartItem {
  key: string;
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  quantityMin: number;
  quantityMax: number;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  minorUnit: number;
  totalMinor: string;
}

export interface StoreCart {
  items: StoreCartItem[];
  coupons: AppliedCoupon[];
  taxLines: CartTaxLine[];
  totals: CartTotals;
  shippingAddress: Address;
  billingAddress: Address;
  needsShipping: boolean;
  needsPayment: boolean;
  hasCalculatedShipping: boolean;
  shippingRates: ShippingRate[];
  errors: string[];
  itemsCount: number;
  cartHash: string;
}

export interface CountryOption {
  code: string;
  name: string;
  states: { code: string; name: string }[];
}

export interface CheckoutDetails {
  shipping: Address;
  billing: Address;
  billingSameAsShipping: boolean;
  customerNote?: string;
  paymentKind?: CheckoutPaymentKind;
}

export interface CheckoutSessionResult {
  orderId: string;
  orderKey: string;
  clientSecret: string;
  amount: number;
  currency: string;
  email: string;
  cart: StoreCart;
  mockPayment?: boolean;
  paymentKind: CheckoutPaymentKind | "mock";
  redirectUrl?: string;
  /** Publishable key from the same account that created this payment. */
  stripePublishableKey?: string;
  /** Reign payment session id. `clientSecret` then holds that session's client secret. */
  reignSessionId?: string;
}

export interface CompleteCheckoutPayload {
  orderId: string;
  orderKey: string;
  paymentIntentId: string;
  provider?: "stripe" | "paypal" | "affirm" | "afterpay" | "reign" | "mock";
}

export interface CreateOrderResult {
  orderId: string;
  orderKey: string;
  total: number;
  currency: string;
  email: string;
  name: string;
  address: string;
  items: CartItem[];
  createdAt: string;
  paid: boolean;
  status: string;
  transactionId?: string;
}

export interface GuestOrder {
  orderId: string;
  orderKey: string;
  status: string;
  paid: boolean;
  email: string;
  name: string;
  totals: CartTotals;
  items: StoreCartItem[];
  shippingAddress: Address;
  billingAddress: Address;
  coupons: AppliedCoupon[];
  createdAt: string;
}
