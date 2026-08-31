const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const targetDir = process.argv[2] || path.join(__dirname, 'SIH frontend', 'src');
const files = walk(path.resolve(__dirname, targetDir));
let changedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    // Match import/export from 'something' or "something"
    const regex = /(import|export)\s+.*?from\s+['"]([^'"]+)['"]/g;
    
    content = content.replace(regex, (match, type, importPath) => {
        // Only process relative paths
        if (!importPath.startsWith('.')) return match;
        
        // Skip if already has an extension
        if (importPath.match(/\.[a-zA-Z0-9]+$/)) return match;
        
        const dir = path.dirname(file);
        const resolvedPath = path.resolve(dir, importPath);
        
        if (fs.existsSync(resolvedPath + '.js')) {
            changed = true;
            return match.replace(importPath, importPath + '.js');
        }
        
        if (fs.existsSync(resolvedPath + '.jsx')) {
            changed = true;
            return match.replace(importPath, importPath + '.jsx');
        }
        
        if (fs.existsSync(path.join(resolvedPath, 'index.js'))) {
            changed = true;
            return match.replace(importPath, importPath + '/index.js');
        }
        
        if (fs.existsSync(path.join(resolvedPath, 'index.jsx'))) {
            changed = true;
            return match.replace(importPath, importPath + '/index.jsx');
        }
        
        return match;
    });
    
    if (changed) {
        fs.writeFileSync(file, content);
        changedFiles++;
        console.log('Fixed imports in:', file);
    }
});

console.log(`Fixed ${changedFiles} files in SIH frontend.`);
