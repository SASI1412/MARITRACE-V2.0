import torch
from torchvision import transforms
from PIL import Image

def preprocess_image(image: Image.Image) -> torch.Tensor:
    """
    Preprocesses the uploaded image for the POSEatSea U-Net + MiT-B2 model.
    The model requires 512x512 input.
    """
    # Ensure RGB
    if image.mode != 'RGB':
        image = image.convert('RGB')
        
    transform = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.ToTensor(),
        # Standard ImageNet normalization used by Segformer/MiT-B2 encoders
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    # Add batch dimension
    tensor = transform(image).unsqueeze(0)
    return tensor
