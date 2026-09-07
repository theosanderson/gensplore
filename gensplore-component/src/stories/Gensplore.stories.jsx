import Gensplore from '../components/GensploreView';
import genbankString from '../../../website/public/phix174.gb?raw';

export default { title: 'Gensplore', component: Gensplore, tags: ['autodocs'] };
export const Phage = { args: { genbankString } };
