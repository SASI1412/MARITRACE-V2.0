import os
import torch
import segmentation_models_pytorch as smp

class POSEatSeaModel:
    def __init__(self, model_path: str = "backend/models/best_sar_model.pth"):
        self.model_path = model_path
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None

    def load(self):
        """
        Loads the POSEatSea U-Net + MiT-B2 architecture and weights.
        """
        print(f"Loading POSEatSea model from {self.model_path} onto {self.device}")
        
        # Instantiate architecture
        self.model = smp.Unet(
            encoder_name="mit_b2",
            encoder_weights=None, # We load our own weights
            in_channels=3,
            classes=5,
        )
        
        if os.path.exists(self.model_path):
            state_dict = torch.load(self.model_path, map_location=self.device)
            # Handle potential DataParallel wrapping in state_dict keys
            if list(state_dict.keys())[0].startswith('module.'):
                state_dict = {k.replace('module.', ''): v for k, v in state_dict.items()}
            self.model.load_state_dict(state_dict)
            print("Model weights loaded successfully.")
        else:
            print(f"Warning: Model weights not found at {self.model_path}. Using untrained weights for demonstration.")
            
        self.model.to(self.device)
        self.model.eval()

    def predict(self, input_tensor: torch.Tensor) -> torch.Tensor:
        """
        Runs inference on the preprocessed tensor.
        """
        if self.model is None:
            raise RuntimeError("Model is not loaded. Call load() first.")
            
        input_tensor = input_tensor.to(self.device)
        with torch.no_grad():
            output = self.model(input_tensor)
            
        return output
