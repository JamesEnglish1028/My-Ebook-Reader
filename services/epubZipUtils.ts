// services/epubZipUtils.ts
// Utility for extracting OPF XML from an EPUB (ZIP) ArrayBuffer

import JSZip from 'jszip';

/**
 * Extract the OPF XML string from an EPUB ArrayBuffer.
 * @param epubData - The EPUB file as an ArrayBuffer
 * @returns The OPF XML string, or throws if not found
 */
export async function extractOpfXmlFromEpub(epubData: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(epubData);
  // Find the path to the OPF file from META-INF/container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('container.xml not found in EPUB');
  const match = containerXml.match(/full-path="([^"]+\.opf)"/);
  if (!match) throw new Error('OPF path not found in container.xml');
  const opfPath = match[1];
  const opfXml = await zip.file(opfPath)?.async('string');
  if (!opfXml) throw new Error(`OPF file not found at ${opfPath}`);
  return opfXml;
}

/**
 * Extract the cover image as a data URL from an EPUB ArrayBuffer.
 * @param epubData - The EPUB file as an ArrayBuffer
 * @returns The cover image as a data URL, or null if not found
 */
export async function extractCoverImageFromEpub(epubData: ArrayBuffer): Promise<string | null> {
  const zip = await JSZip.loadAsync(epubData);
  // Find the path to the OPF file from META-INF/container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) return null;
  const match = containerXml.match(/full-path="([^"]+\.opf)"/);
  if (!match) return null;
  const opfPath = match[1];
  const opfXml = await zip.file(opfPath)?.async('string');
  if (!opfXml) return null;

  // Helper to resolve relative paths
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
  const resolvePath = (href: string) => opfDir + href;

  // 1. EPUB2: <meta name="cover" content="cover-image-id" />
  let coverId: string | null = null;
  let coverHref: string | null = null;
  let mediaType: string | null = null;
  const metaCoverMatch = opfXml.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  if (metaCoverMatch) {
    coverId = metaCoverMatch[1];
  }

  // 2. EPUB3: <item properties="cover-image" ...>
  if (!coverId) {
    const propCoverMatch = opfXml.match(/<item[^>]+properties=["'][^"']*cover-image[^"']*["'][^>]+id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]+media-type=["']([^"']+)["'][^>]*>/i);
    if (propCoverMatch) {
      coverId = propCoverMatch[1];
      coverHref = propCoverMatch[2];
      mediaType = propCoverMatch[3];
    }
  }

  // 3. Fallback: <item id="cover" ...> or id containing "cover"
  if (!coverId) {
    const itemMatch = opfXml.match(/<item[^>]+id=["']([^"']*cover[^"']*)["'][^>]*href=["']([^"']+)["'][^>]+media-type=["']([^"']+)["'][^>]*>/i);
    if (itemMatch) {
      coverId = itemMatch[1];
      coverHref = itemMatch[2];
      mediaType = itemMatch[3];
    }
  }

  // 4. If we have a coverId but not href, find the <item> with that id
  if (coverId && !coverHref) {
    const itemTagRegex = new RegExp(`<item[^>]+id=["']${coverId}["'][^>]+href=["']([^"']+)["'][^>]+media-type=["']([^"']+)["'][^>]*>`, 'i');
    const itemTagMatch = opfXml.match(itemTagRegex);
    if (itemTagMatch) {
      coverHref = itemTagMatch[1];
      mediaType = itemTagMatch[2];
    }
  }

  // 5. Fallback: first <item> with media-type image/jpeg or image/png
  if (!coverHref) {
    const imageItemMatch = opfXml.match(/<item[^>]+href=["']([^"']+)["'][^>]+media-type=["'](image\/(jpeg|png|gif|jpg))["'][^>]*>/i);
    if (imageItemMatch) {
      coverHref = imageItemMatch[1];
      mediaType = imageItemMatch[2];
    }
  }

  // 6. Fallback: try to find the first <itemref> in <spine> and parse its referenced XHTML for an <img>
  if (!coverHref) {
    const spineMatch = opfXml.match(/<spine[\s\S]*?<itemref[^>]+idref=["']([^"']+)["'][^>]*>/i);
    if (spineMatch) {
      const idref = spineMatch[1];
      const itemTagRegex = new RegExp(`<item[^>]+id=["']${idref}["'][^>]+href=["']([^"']+)["'][^>]+media-type=["']application/xhtml+xml["'][^>]*>`, 'i');
      const itemTagMatch = opfXml.match(itemTagRegex);
      if (itemTagMatch) {
        const xhtmlHref = itemTagMatch[1];
        const xhtmlPath = resolvePath(xhtmlHref);
        const xhtmlFile = zip.file(xhtmlPath);
        if (xhtmlFile) {
          const xhtml = await xhtmlFile.async('string');
          // Find first <img src="...">
          const imgMatch = xhtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
          if (imgMatch) {
            coverHref = imgMatch[1];
            // Try to guess media type from extension
            if (coverHref.endsWith('.png')) mediaType = 'image/png';
            else if (coverHref.endsWith('.jpg') || coverHref.endsWith('.jpeg')) mediaType = 'image/jpeg';
            else if (coverHref.endsWith('.gif')) mediaType = 'image/gif';
          }
        }
      }
    }
  }

  if (!coverHref) return null;
  const coverPath = resolvePath(coverHref);
  const file = zip.file(coverPath);
  if (!file) return null;
  const blob = await file.async('blob');
  // Convert blob to data URL
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
