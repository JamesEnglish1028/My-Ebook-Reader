export const palaceRootFeedXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Palace Root</title>
  <entry>
    <title>Featured (12)</title>
    <link
      type="application/atom+xml;profile=opds-catalog;kind=navigation"
      href="https://demo.palaceproject.io/groups/featured"
    />
    <id>https://demo.palaceproject.io/groups/featured</id>
    <content>Featured lane</content>
  </entry>
  <entry>
    <title>Kids (8)</title>
    <link
      type="application/atom+xml;profile=opds-catalog;kind=navigation"
      href="https://demo.palaceproject.io/groups/kids"
    />
    <id>https://demo.palaceproject.io/groups/kids</id>
    <content>Kids lane</content>
  </entry>
</feed>`;

export const palaceFeaturedLaneXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Featured</title>
  <entry>
    <title>Palace Preview Book</title>
    <id>urn:uuid:palace-preview-book</id>
    <author><name>Palace Author</name></author>
    <link
      rel="http://opds-spec.org/acquisition"
      href="https://demo.palaceproject.io/books/palace-preview-book.epub"
      type="application/epub+zip"
    />
  </entry>
</feed>`;

export const palaceKidsLaneXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Kids</title>
  <entry>
    <title>Ages 0-5 (3)</title>
    <link
      type="application/atom+xml;profile=opds-catalog;kind=navigation"
      href="https://demo.palaceproject.io/groups/kids/ages-0-5"
    />
    <id>https://demo.palaceproject.io/groups/kids/ages-0-5</id>
    <content>Nested kids lane</content>
  </entry>
</feed>`;
