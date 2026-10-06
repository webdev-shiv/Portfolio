import rembg
from PIL import Image, ImageFilter, ImageOps
import numpy as np

def generate_cutout():
    print("Loading portrait_raw.png...")
    input_img = Image.open('d:/p1/portrait_raw.png').convert('RGBA')
    
    # Run rembg with u2netp
    session = rembg.new_session('u2netp')
    cutout = rembg.remove(input_img, session=session, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10)
    
    # Save standard transparent cutout
    cutout.save('d:/p1/shivam_cutout.png', 'PNG')
    print("Saved shivam_cutout.png successfully! Size:", cutout.size)
    
    # Now let's create a red-rimmed and shadow-integrated version for supreme cinematic look
    # 1. Extract alpha channel
    r, g, b, alpha = cutout.split()
    
    # Create red rim light mask: edge of alpha
    edge_mask = alpha.filter(ImageFilter.FIND_EDGES)
    edge_mask = edge_mask.filter(ImageFilter.GaussianBlur(radius=2))
    
    # Soft red rim light
    red_layer = Image.new('RGBA', cutout.size, (230, 30, 45, 0))
    # Apply rim light primarily to top-right/top edge (matching the key light direction)
    np_alpha = np.array(alpha, dtype=float) / 255.0
    np_edge = np.array(edge_mask, dtype=float) / 255.0
    
    # Rim light multiplier: where alpha is inside, but close to edge
    rim_alpha = (np_edge * np_alpha * 180).clip(0, 255).astype(np.uint8)
    red_layer.putalpha(Image.fromarray(rim_alpha))
    
    # Composite rim light over cutout
    cutout_rim = Image.alpha_composite(cutout, red_layer)
    cutout_rim.save('d:/p1/shivam_cutout_rim.png', 'PNG')
    print("Saved shivam_cutout_rim.png with cinematic red rim-light!")

if __name__ == '__main__':
    generate_cutout()
