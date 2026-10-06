from PIL import Image
import numpy as np

img = Image.open('d:/p1/portrait_raw.png').convert('RGB')
arr = np.array(img)

# Sample background top-left corner
tl = arr[:30, :30]
print("Top-left (background PORTFOLIO text/red):")
print("R mean:", np.mean(tl[:,:,0]), "G mean:", np.mean(tl[:,:,1]), "B mean:", np.mean(tl[:,:,2]))

# Sample background top-right corner
tr = arr[:30, -30:]
print("Top-right (background):")
print("R mean:", np.mean(tr[:,:,0]), "G mean:", np.mean(tr[:,:,1]), "B mean:", np.mean(tr[:,:,2]))

# Sample face center (around y=120, x=150)
face = arr[110:140, 140:170]
print("Face center:")
print("R mean:", np.mean(face[:,:,0]), "G mean:", np.mean(face[:,:,1]), "B mean:", np.mean(face[:,:,2]))

# Sample hair (around y=60, x=170)
hair = arr[40:70, 160:190]
print("Hair:")
print("R mean:", np.mean(hair[:,:,0]), "G mean:", np.mean(hair[:,:,1]), "B mean:", np.mean(hair[:,:,2]))

# Sample suit (around y=300, x=200)
suit = arr[280:320, 180:220]
print("Suit:")
print("R mean:", np.mean(suit[:,:,0]), "G mean:", np.mean(suit[:,:,1]), "B mean:", np.mean(suit[:,:,2]))
