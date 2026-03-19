const FETCH_TIMEOUT = 5_000;
const MAX_SUBPAGES = 5;
const MAX_BODY_LENGTH = 2_000;

const COMMON_SUBPAGES = [
  "/over-ons", "/about", "/about-us",
  "/diensten", "/services",
  "/contact",
  "/producten", "/products",
  "/team",
  "/prijzen", "/pricing",
];

const TECH_SIGNATURES: Record<string, RegExp[]> = {
  WordPress: [/wp-content/i, /wp-includes/i, /wordpress/i],
  Shopify: [/cdn\.shopify\.com/i, /shopify/i],
  Wix: [/wix\.com/i, /wixsite/i],
  Squarespace: [/squarespace/i, /static1\.squarespace/i],
  WooCommerce: [/woocommerce/i, /wc-/i],
  React: [/__next/i, /react/i, /_next\/static/i],
  "Next.js": [/_next\//i, /__NEXT_DATA__/i],
  Webflow: [/webflow/i],
  Magento: [/magento/i, /mage\//i],
  Joomla: [/joomla/i, /com_content/i],
  Lightspeed: [/lightspeed/i, /seoshop/i],
};

const CHAT_SIGNATURES: Record<string, RegExp[]> = {
  Intercom: [/intercom/i, /intercomcdn/i],
  Drift: [/drift\.com/i, /driftt/i],
  Tidio: [/tidio/i, /tidiochat/i],
  "WhatsApp Widget": [/wa\.me/i, /whatsapp/i],
  LiveChat: [/livechatinc/i, /livechat/i],
  Zendesk: [/zopim/i, /zendesk/i],
  HubSpot: [/hubspot/i, /hs-scripts/i],
  Crisp: [/crisp\.chat/i],
};

export interface ScrapeResult {
  homepage: PageData;
  subpaginas: PageData[];
  techStack: string[];
  formulieren: string[];
  chatWidgets: string[];
  socialMedia: Record<string, string>;
}

interface PageData {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  bodyText: string;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    return res.text();
  } catch {
    return null;
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : "";
}

function extractMetaDescription(html: string): string {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (match) return match[1].trim();
  const match2 = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  return match2 ? match2[1].trim() : "";
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const regex = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && headings.length < 20) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (text) headings.push(`${match[1]}: ${text}`);
  }
  return headings;
}

function extractBodyText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, MAX_BODY_LENGTH);
}

function parsePage(url: string, html: string): PageData {
  return {
    url,
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    headings: extractHeadings(html),
    bodyText: extractBodyText(html),
  };
}

function detectTechStack(html: string): string[] {
  const found: string[] = [];
  for (const [tech, patterns] of Object.entries(TECH_SIGNATURES)) {
    if (patterns.some((p) => p.test(html))) {
      found.push(tech);
    }
  }
  return found;
}

function detectForms(html: string): string[] {
  const forms: string[] = [];
  const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = formRegex.exec(html)) !== null) {
    const formContent = match[0].toLowerCase();
    if (/contact|bericht|message|vraag/i.test(formContent)) forms.push("contact");
    else if (/offerte|quote|aanvraag/i.test(formContent)) forms.push("offerte-aanvraag");
    else if (/newsletter|nieuwsbrief|subscribe|inschrijv/i.test(formContent)) forms.push("nieuwsbrief");
    else if (/search|zoek/i.test(formContent)) forms.push("zoekformulier");
    else forms.push("formulier");
  }
  return [...new Set(forms)];
}

function detectChatWidgets(html: string): string[] {
  const found: string[] = [];
  for (const [widget, patterns] of Object.entries(CHAT_SIGNATURES)) {
    if (patterns.some((p) => p.test(html))) {
      found.push(widget);
    }
  }
  return found;
}

function detectSocialMedia(html: string): Record<string, string> {
  const social: Record<string, string> = {};
  const patterns: Record<string, RegExp> = {
    linkedin: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s]+)["']/i,
    instagram: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)["']/i,
    facebook: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/i,
    twitter: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"'\s]+)["']/i,
    youtube: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"'\s]+)["']/i,
  };
  for (const [platform, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) social[platform] = match[1];
  }
  return social;
}

function findInternalLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const regex = /href=["']([^"'#]+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1].trim();
    if (href.startsWith("/") && !href.startsWith("//")) {
      links.push(href);
    } else if (href.startsWith(baseUrl)) {
      links.push(href.replace(baseUrl, ""));
    }
  }
  return [...new Set(links)];
}

function isSSRFSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return false;
    if (hostname.startsWith("10.")) return false;
    if (hostname.startsWith("172.") && /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (hostname.startsWith("192.168.")) return false;
    if (hostname.startsWith("169.254.")) return false;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
}

export async function scrapeWebsite(websiteUrl: string): Promise<ScrapeResult> {
  if (!isSSRFSafe(websiteUrl)) {
    throw new Error("URL niet toegestaan: privé netwerk of ongeldig protocol");
  }

  const baseUrl = websiteUrl.replace(/\/+$/, "");
  const homepageHtml = await fetchPage(baseUrl);

  if (!homepageHtml) {
    throw new Error(`Kon ${baseUrl} niet bereiken`);
  }

  const homepage = parsePage(baseUrl, homepageHtml);
  const techStack = detectTechStack(homepageHtml);
  const formulieren = detectForms(homepageHtml);
  const chatWidgets = detectChatWidgets(homepageHtml);
  const socialMedia = detectSocialMedia(homepageHtml);

  // Find subpages to scrape
  const internalLinks = findInternalLinks(homepageHtml, baseUrl);
  const subpageUrls: string[] = [];

  for (const commonPath of COMMON_SUBPAGES) {
    const matchingLink = internalLinks.find(
      (link) => link.toLowerCase().includes(commonPath.replace("/", ""))
    );
    if (matchingLink && subpageUrls.length < MAX_SUBPAGES) {
      subpageUrls.push(matchingLink.startsWith("http") ? matchingLink : `${baseUrl}${matchingLink}`);
    }
  }

  // Scrape subpages
  const subpaginas: PageData[] = [];
  for (const url of subpageUrls) {
    if (!isSSRFSafe(url)) continue;
    const html = await fetchPage(url);
    if (html) {
      subpaginas.push(parsePage(url, html));
      for (const tech of detectTechStack(html)) {
        if (!techStack.includes(tech)) techStack.push(tech);
      }
      for (const form of detectForms(html)) {
        if (!formulieren.includes(form)) formulieren.push(form);
      }
      for (const widget of detectChatWidgets(html)) {
        if (!chatWidgets.includes(widget)) chatWidgets.push(widget);
      }
      const subSocial = detectSocialMedia(html);
      for (const [platform, socialUrl] of Object.entries(subSocial)) {
        if (!socialMedia[platform]) socialMedia[platform] = socialUrl;
      }
    }
  }

  return { homepage, subpaginas, techStack, formulieren, chatWidgets, socialMedia };
}
