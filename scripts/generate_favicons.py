import os
from PIL import Image, ImageDraw

def render_coursepilot_icon(size=512):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size / 100.0

    def sc(coords):
        return [(int(x * scale), int(y * scale)) for x, y in coords]

    # Background circle/rounded rect for high-contrast visibility
    radius = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=(11, 19, 43, 255))

    # Inner elements scaled
    # 1. C-Ribbon (outer arc)
    c_pts = [
        (50, 25), (32, 25), (20, 38), (20, 54), (20, 70), (33, 83), (50, 83),
        (68, 76), (57, 69), (48, 72), (30, 54), (49, 35), (67, 44), (76, 36)
    ]
    draw.polygon(sc([
        (50, 25), (28, 25), (18, 40), (18, 64), (32, 82), (54, 84), (70, 76),
        (56, 68), (32, 62), (30, 48), (42, 36), (62, 38), (72, 32), (54, 25)
    ]), fill=(0, 150, 255, 255))

    # 2. Bottom loop
    draw.polygon(sc([
        (42, 70), (62, 70), (74, 60), (76, 70), (66, 82), (48, 83), (36, 78)
    ]), fill=(124, 58, 237, 255))

    # 3. Top Cap (Mortarboard Rhombus)
    cap_top = sc([(50, 8), (84, 23), (50, 38), (16, 23)])
    draw.polygon(cap_top, fill=(29, 78, 216, 255))
    
    # Cap highlight line
    draw.line(sc([(16, 23), (50, 8), (84, 23)]), fill=(56, 189, 248, 255), width=max(2, int(size * 0.03)))

    # Cap base rim
    draw.polygon(sc([(28, 28), (50, 37), (72, 28), (72, 33), (50, 42), (28, 33)]), fill=(15, 40, 112, 255))

    # Tassel
    draw.line(sc([(50, 23), (74, 34), (75, 44)]), fill=(30, 64, 175, 255), width=max(2, int(size * 0.02)))
    draw.ellipse([int(48 * scale), int(21 * scale), int(52 * scale), int(25 * scale)], fill=(56, 189, 248, 255))
    draw.polygon(sc([(72, 43), (77, 43), (78, 52), (71, 52)]), fill=(29, 78, 216, 255))

    # 4. Pilot Navigation Compass Arrow
    arrow_left = sc([(58, 39), (42, 58), (49, 55)])
    draw.polygon(arrow_left, fill=(56, 189, 248, 255))
    arrow_right = sc([(58, 39), (49, 55), (52, 68)])
    draw.polygon(arrow_right, fill=(2, 132, 199, 255))

    return img

def main():
    public_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")
    os.makedirs(public_dir, exist_ok=True)

    # 512x512
    img512 = render_coursepilot_icon(512)
    img512.save(os.path.join(public_dir, "icon-512.png"), "PNG")
    img512.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")

    # 192x192
    img192 = render_coursepilot_icon(192)
    img192.save(os.path.join(public_dir, "icon-192.png"), "PNG")

    # 32x32
    img32 = render_coursepilot_icon(32)
    img32.save(os.path.join(public_dir, "favicon-32x32.png"), "PNG")
    img32.save(os.path.join(public_dir, "favicon.png"), "PNG")

    # 16x16
    img16 = render_coursepilot_icon(16)
    img16.save(os.path.join(public_dir, "favicon-16x16.png"), "PNG")

    # favicon.ico (multi-size ICO: 16, 32, 48, 64)
    img48 = render_coursepilot_icon(48)
    img64 = render_coursepilot_icon(64)
    img32.save(
        os.path.join(public_dir, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )

    print("Successfully generated all PNG and ICO favicons in frontend/public/")

if __name__ == "__main__":
    main()
