from PIL import Image

img = Image.open('d:/p1/user_reference.png')
# Reference image is 576x1024
crop = img.crop((130, 65, 500, 422))
crop.save('d:/p1/portrait_raw.png')
print('Saved portrait_raw.png', crop.size)
