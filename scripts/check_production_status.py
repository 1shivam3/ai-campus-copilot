import urllib.request
import re
import json

def check_prod():
    print("=== CHECKING PRODUCTION HTML & ASSETS ===")
    req = urllib.request.Request('https://ai-campus-copilot-one.vercel.app/', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8')
        print("HTML length:", len(html))
        
        # Find all script src and link href
        scripts = re.findall(r'src=["\']([^"\']+)["\']', html)
        links = re.findall(r'href=["\']([^"\']+)["\']', html)
        
        print("Scripts:", scripts)
        print("Links:", links)
        
        for asset in scripts + links:
            if asset.startswith('/assets/'):
                url = f'https://ai-campus-copilot-one.vercel.app{asset}'
                try:
                    r = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(r, timeout=15) as res:
                        data = res.read()
                        print(f"[OK] {url} -> {res.status} ({res.headers.get('Content-Type')}, {len(data)} bytes)")
                except Exception as e:
                    print(f"[FAIL] {url} -> {e}")

    print("\n=== CHECKING SERVICE WORKER ===")
    sw_url = 'https://ai-campus-copilot-one.vercel.app/sw.js'
    try:
        r = urllib.request.Request(sw_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(r, timeout=15) as res:
            sw_code = res.read().decode('utf-8')
            print(f"[OK] sw.js -> {res.status}, length: {len(sw_code)}")
            print("SW Cache Name:", re.findall(r'CACHE_NAME\s*=\s*["\']([^"\']+)["\']', sw_code))
    except Exception as e:
        print(f"[FAIL] sw.js -> {e}")

    print("\n=== CHECKING BACKEND ===")
    be_url = 'https://ai-campus-copilot-uanp.onrender.com/health'
    try:
        r = urllib.request.Request(be_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(r, timeout=15) as res:
            print(f"[OK] {be_url} -> {res.status}: {res.read().decode('utf-8')}")
    except Exception as e:
        print(f"[FAIL] {be_url} -> {e}")

if __name__ == '__main__':
    check_prod()
