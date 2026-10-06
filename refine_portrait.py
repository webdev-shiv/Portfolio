from PIL import Image, ImageFilter
import numpy as np

img = Image.open('d:/p1/shivam_cutout.png')
r, g, b, a = img.split()

arr_a = np.array(a, dtype=np.uint8)
h, w = arr_a.shape

# Clean text on bottom left: x < 75 and y > 240
arr_a[240:, :75] = 0

# Clean top-left corner outside hair:
for y in range(h):
    for x in range(w):
        # Above hair
        if y < 18:
            arr_a[y, x] = 0
        # Left of shoulder
        if x < 40 and y < 220:
            arr_a[y, x] = 0
        # Right of right shoulder
        if x > 336:
            arr_a[y, x] = 0

# Now find the largest connected component of foreground
from scipy.ndimage import label, binary_fill_holes

binary = arr_a > 30
labeled, num_features = label(binary)
if num_features > 0:
    # Find component covering center (around y=180, x=180)
    center_label = labeled[180, 180]
    if center_label == 0:
        # Get largest component
        sizes = [np.sum(labeled == i) for i in range(1, num_features + 1)]
        center_label = np.argmax(sizes) + 1
    
    clean_mask = (labeled == center_label)
    # Fill any internal holes in the suit/skin
    clean_mask = binary_fill_holes(clean_mask)
    
    # Smooth edges with slight Gaussian blur
    mask_img = Image.fromarray((clean_mask * 255).astype(np.uint8))
    # Slight feathering for natural hair and fabric edges
    mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=1.2))
    
    clean_a = np.array(mask_img)
    # Combine with original alpha to keep soft hair details
    final_a = np.minimum(clean_a, np.maximum(arr_a, clean_a))
    
    # Bottom fade-out into dark for seamless hero integration
    for y in range(h - 30, h):
        factor = (h - 1 - y) / 30.0
        final_a[y, :] = (final_a[y, :] * factor).astype(np.uint8)

    # Save cleaned cutout
    cleaned_cutout = Image.merge('RGBA', (r, g, b, Image.fromarray(final_a)))
    cleaned_cutout.save('d:/p1/shivam_cutout_clean.png', 'PNG')
    print("Saved shivam_cutout_clean.png!")

    # Now add cinematic rim lighting + bottom shadow
    # Red rim light on right side and top hair
    edge = Image.fromarray(final_a).filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(radius=2))
    edge_np = np.array(edge, dtype=float) / 255.0
    
    # Directional gradient: emphasize top and right
    yy, xx = np.mgrid[0:h, 0:w]
    dir_weight = ((xx / w) * 0.7 + (1.0 - yy / h) * 0.5).clip(0, 1)
    
    rim_intensity = (edge_np * (final_a / 255.0) * dir_weight * 210).clip(0, 255).astype(np.uint8)
    
    red_layer = Image.new('RGBA', (w, h), (240, 35, 50, 0))
    red_layer.putalpha(Image.fromarray(rim_intensity))
    
    final_comp = Image.alpha_composite(cleaned_cutout, red_layer)
    final_comp.save('d:/p1/shivam_hero_portrait.png', 'PNG')
    print("Saved d:/p1/shivam_hero_portrait.png!")
