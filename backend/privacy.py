import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from backend.config import STATIC_DIR

SAMPLE_IMAGES_DIR = os.path.join(STATIC_DIR, "sample_images")

def apply_edge_privacy_filter(input_path: str, output_path: str, blur_regions: list = None):
    """
    Applies on-device edge privacy preservation:
    Detects and blurs sensitive regions (faces, license plates) before
    the crop is transmitted over cellular network.
    """
    img = Image.open(input_path).convert("RGB")
    if not blur_regions:
        # Default mock sensitive zones (e.g. license plate or passerby)
        w, h = img.size
        blur_regions = [
            (int(w * 0.05), int(h * 0.1), int(w * 0.35), int(h * 0.35)),  # Passerby face zone
            (int(w * 0.65), int(h * 0.75), int(w * 0.95), int(h * 0.92))   # Vehicle license plate zone
        ]

    for (x1, y1, x2, y2) in blur_regions:
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(img.width, x2), min(img.height, y2)
        if x2 > x1 and y2 > y1:
            box = (x1, y1, x2, y2)
            cropped_region = img.crop(box)
            # Mosaic pixelation + Gaussian blur
            small = cropped_region.resize((max(1, (x2 - x1) // 10), max(1, (y2 - y1) // 10)), resample=Image.NEAREST)
            pixelated = small.resize((x2 - x1, y2 - y1), Image.NEAREST)
            blurred = pixelated.filter(ImageFilter.GaussianBlur(radius=8))
            img.paste(blurred, box)

            # Draw green privacy border indicator
            draw = ImageDraw.Draw(img)
            draw.rectangle(box, outline="#10B981", width=2)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "JPEG", quality=85)
    return output_path

def ensure_sample_images():
    """Generates clear, illustrative synthetic images for each verification scenario."""
    os.makedirs(SAMPLE_IMAGES_DIR, exist_ok=True)

    scenarios = [
        {
            "id": "mixed_waste",
            "title": "ROADSIDE GARBAGE DUMP",
            "bg_color": (210, 215, 220),
            "elements": "dump",
            "notes": "Plastic bags, corrugated boxes, food wrappers obstructing pavement."
        },
        {
            "id": "overflowing_bin",
            "title": "OVERFLOWING MUNICIPAL BIN",
            "bg_color": (195, 210, 200),
            "elements": "bin",
            "notes": "Green commercial wheelie bin filled to capacity, spillover on road."
        },
        {
            "id": "animal",
            "title": "STRAY ANIMAL (NON-WASTE)",
            "bg_color": (220, 215, 200),
            "elements": "animal",
            "notes": "Street dog / indigenous cattle resting curbside. False-positive filter."
        },
        {
            "id": "construction",
            "title": "CONSTRUCTION & DEMOLITION (C&D)",
            "bg_color": (220, 205, 195),
            "elements": "construction",
            "notes": "Stacked red bricks, cement sand, concrete rubble on road shoulder."
        }
    ]

    for sc in scenarios:
        raw_path = os.path.join(SAMPLE_IMAGES_DIR, f"{sc['id']}_raw.jpg")
        blurred_path = os.path.join(SAMPLE_IMAGES_DIR, f"{sc['id']}_blurred.jpg")

        if not os.path.exists(raw_path):
            img = Image.new("RGB", (640, 480), color=sc["bg_color"])
            draw = ImageDraw.Draw(img)

            # Draw Road & Sidewalk
            draw.rectangle([(0, 260), (640, 480)], fill=(80, 85, 90)) # Asphalt
            draw.line([(0, 370), (640, 370)], fill=(255, 255, 255), width=4) # Lane divider
            draw.rectangle([(0, 160), (640, 260)], fill=(160, 165, 170)) # Sidewalk
            draw.line([(0, 260), (640, 260)], fill=(220, 220, 100), width=6) # Curb

            # Add simulated pedestrian / vehicle with license plate for privacy demonstration
            # Passerby silhouette on top left
            draw.ellipse([(60, 60), (120, 120)], fill=(220, 180, 140)) # Face
            draw.rectangle([(40, 120), (140, 220)], fill=(50, 70, 120)) # Body
            # Simulated vehicle license plate on bottom right
            draw.rectangle([(450, 390), (600, 440)], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
            draw.text((470, 405), "KA 05 MN 9284", fill=(0, 0, 0))

            # Draw scenario specific objects
            if sc["elements"] == "dump":
                # Pile of garbage bags and boxes
                draw.rectangle([(220, 210), (330, 280)], fill=(40, 40, 40)) # Black trash bag
                draw.ellipse([(200, 220), (280, 275)], fill=(30, 90, 180)) # Blue bag
                draw.rectangle([(300, 220), (410, 285)], fill=(180, 130, 80), outline=(120, 80, 40), width=2) # Cardboard box
                draw.ellipse([(260, 250), (360, 290)], fill=(220, 50, 50)) # Red trash bag
                # Debris scraps
                for offset in [(190, 270), (370, 275), (420, 265), (280, 285)]:
                    draw.polygon([(offset[0], offset[1]), (offset[0]+20, offset[1]-10), (offset[0]+15, offset[1]+15)], fill=(240, 240, 240))

            elif sc["elements"] == "bin":
                # Municipal green bin
                draw.rectangle([(250, 170), (390, 320)], fill=(34, 139, 34), outline=(20, 80, 20), width=3)
                # Wheels
                draw.ellipse([(260, 310), (290, 340)], fill=(20, 20, 20))
                draw.ellipse([(350, 310), (380, 340)], fill=(20, 20, 20))
                # Open lid with overflowing garbage
                draw.polygon([(240, 170), (400, 140), (400, 150), (240, 180)], fill=(20, 100, 20))
                draw.ellipse([(270, 120), (340, 170)], fill=(40, 40, 40)) # Bags spilling
                draw.ellipse([(320, 110), (390, 160)], fill=(200, 200, 200))
                draw.rectangle([(290, 130), (360, 175)], fill=(200, 80, 50))

            elif sc["elements"] == "animal":
                # Sleeping dog / cow
                draw.ellipse([(230, 230), (370, 290)], fill=(180, 110, 50)) # Dog body
                draw.ellipse([(340, 210), (395, 260)], fill=(160, 95, 40)) # Head
                draw.polygon([(360, 205), (380, 190), (385, 215)], fill=(130, 70, 30)) # Ear
                draw.ellipse([(220, 260), (250, 295)], fill=(160, 95, 40)) # Paw

            elif sc["elements"] == "construction":
                # Pile of bricks and gravel
                for row in range(4):
                    for col in range(5):
                        bx = 240 + col * 30 + (row % 2) * 12
                        by = 220 + row * 18
                        draw.rectangle([(bx, by), (bx + 26, by + 14)], fill=(178, 58, 42), outline=(120, 30, 20), width=1)
                # Sand mound
                draw.chord([(370, 220), (470, 290)], 0, 180, fill=(210, 180, 120))

            # Overlay HUD Telemetry stamp
            draw.rectangle([(0, 0), (640, 45)], fill=(0, 0, 0))
            draw.text((15, 6), f"KASA.EDGE ON-DEVICE SENSING // {sc['title']}", fill=(0, 255, 128))
            draw.text((15, 24), "GPS: 12.9716 N, 77.5946 E | ACC: 3.8m | CAM: 1080p@30fps [BUFFER LOCAL]", fill=(180, 180, 180))

            img.save(raw_path, "JPEG", quality=85)
            # Create privacy-blurred version
            apply_edge_privacy_filter(raw_path, blurred_path, blur_regions=[
                (40, 50, 140, 220),    # Passerby
                (450, 385, 605, 445)   # License plate
            ])

ensure_sample_images()
