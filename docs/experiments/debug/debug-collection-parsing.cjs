const fs = require('fs');
const { JSDOM } = require('jsdom');

// Read the Minotaur OPDS file
const xmlContent = fs.readFileSync('./test-data/MinotaurOPDS.xml', 'utf8');

// Simple collection parsing test
function testCollectionParsing(xmlText) {
    const dom = new JSDOM(xmlText, { contentType: "application/xml" });
    const xmlDoc = dom.window.document;
    
    const entries = Array.from(xmlDoc.querySelectorAll('entry'));
    console.log(`Found ${entries.length} entries in the OPDS feed`);
    
    let booksWithCollections = 0;
    const collectionsFound = new Set();
    
    entries.forEach((entry, index) => {
        const title = entry.querySelector('title')?.textContent?.trim() || 'Untitled';
        const collectionLinks = Array.from(entry.querySelectorAll('link[rel="collection"]'));
        
        if (collectionLinks.length > 0) {
            booksWithCollections++;
            console.log(`\nBook ${index + 1}: "${title}"`);
            console.log(`  Collections: ${collectionLinks.length}`);
            
            collectionLinks.forEach(link => {
                const collectionTitle = link.getAttribute('title');
                const collectionHref = link.getAttribute('href');
                console.log(`    - ${collectionTitle} (${collectionHref})`);
                collectionsFound.add(collectionTitle);
            });
        }
        
        // Check for categories too
        const categories = Array.from(entry.querySelectorAll('category'));
        if (index < 3) { // Show first 3 books' categories
            console.log(`\nBook ${index + 1} categories: ${categories.length}`);
            categories.forEach(cat => {
                const scheme = cat.getAttribute('scheme');
                const term = cat.getAttribute('term');
                const label = cat.getAttribute('label');
                console.log(`    - ${label} (scheme: ${scheme}, term: ${term})`);
            });
        }
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total entries: ${entries.length}`);
    console.log(`Books with collections: ${booksWithCollections}`);
    console.log(`Unique collections found: ${collectionsFound.size}`);
    console.log(`Collections: ${Array.from(collectionsFound).join(', ')}`);
    
    return {
        totalEntries: entries.length,
        booksWithCollections,
        uniqueCollections: collectionsFound.size,
        collections: Array.from(collectionsFound)
    };
}

// Run the test
console.log('Testing collection parsing with Minotaur OPDS data...\n');
const result = testCollectionParsing(xmlContent);

// Check if our parsing logic would detect collections
console.log(`\n=== COLLECTION DETECTION TEST ===`);
console.log(`Would hasCollections be true? ${result.booksWithCollections > 0}`);
console.log(`Collections available for "By Collection" mode? ${result.uniqueCollections > 0 ? 'YES' : 'NO'}`);