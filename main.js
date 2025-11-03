
// --- shortened for brevity, the key fix is in the appendScript below ---

const appendScript = `
    (function() {
        function b64decode(b64) {
            var chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var out="", buffer=0, bits=0, c;
            for (var i=0;i<b64.length;i++){
                c=b64.charAt(i);
                if(c==='=')break;
                var idx=chars.indexOf(c);
                if(idx===-1)continue;
                buffer=(buffer<<6)|idx; bits+=6;
                if(bits>=8){bits-=8;out+=String.fromCharCode((buffer>>bits)&0xFF);}
            }
            return out;
        }
        try {
            var f = new File(Folder.temp.fsName + "/temp.ffx");
            if (!f.exists) { f.encoding = "BINARY"; f.open("w"); f.close(); }
            if (!f.open("a")) return "Error: Cannot open temp.ffx for append";
            var bin = b64decode('${chunk}');
            f.write(bin);
            f.close();
            return "OK";
        } catch(e) { return "Error: " + e.toString(); }
    })();
`;

// --- shortened for brevity ---
