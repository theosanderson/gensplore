# Gensplore

A simple genome browser for smallish genomes (e.g. viruses and bacteria) 

![image](https://user-images.githubusercontent.com/19732295/219011538-43b9b66b-0227-4171-87c6-08b496a7bf2e.png)

## https://gensplore.genomium.org/

### Adding custom genomes

For viewing a custom genome every now and then, just use the "Choose file" option. If you are doing this all the time you might want an easier method. Bacterial genomes load too slowly from NCBI for us to load them directly, but you can upload your own to a website that allows CORS access, then go to `http://gensplore.theo.io/?gb=http://mywebsite.com/myfile.gb`. If you have trouble with this feel free to raise an Issue and we may be able to add your genome.

### React component

There is now a React component for embedding Gensplore in your own website. See [here](gensplore-component/README.md) for details.


