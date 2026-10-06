import sys
from PIL import Image

def process():
    try:
        from rembg import remove
        print("Using rembg...")
        input_image = Image.open('d:/p1/portrait_raw.png')
        output_image = remove(input_image)
        output_image.save('d:/p1/shivam_portrait_cutout.png')
        print("Successfully generated cutout with rembg!")
        return True
    except Exception as e:
        print("rembg error or not ready:", e)
        return False

if __name__ == '__main__':
    process()
