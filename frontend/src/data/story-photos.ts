// Story photos from the "CÂU CHUYỆN HÀ NỘI" folder, resized to public/images/stories.
// Each photo keeps the caption and the source named in its file name.

import type { HanoiImage } from "./hanoi-images";
import { festivalStoryNames, festivalStoryPhotos } from "./festival-photos";

export type StoryPhoto = {
  key: string;
  src: string;
  width: number;
  height: number;
  caption: { vi: string; en: string };
  /** The source as the folder names it ("Collected" when none is given), or the photographer. */
  credit: string;
  /** Openly licensed photos (Wikimedia Commons) also give the licence and the original file. */
  license?: string;
  sourceUrl?: string;
};

/** The folder's photos of each story, in its order; the story's image_key names its cover. */
const folderPhotos: Record<string, StoryPhoto[]> = {
  "pho-ca-phe-duong-tau": [
    { key: "pho-ca-phe-duong-tau-1", src: "/images/stories/pho-ca-phe-duong-tau-1.jpg", width: 1600, height: 1067, caption: { vi: "Du khách đổ xô đến các quán cà phê ở phố đường tàu để chụp ảnh", en: "Visitors flock to the Train Street cafés to take photos" }, credit: "Hoàng Giang" },
    { key: "pho-ca-phe-duong-tau-2", src: "/images/stories/pho-ca-phe-duong-tau-2.jpg", width: 1600, height: 1067, caption: { vi: "Khách quốc tế đến chụp ảnh tại phố cà phê đường tàu ở Hà Nội", en: "International visitors taking photos at Hanoi's Train Street cafés" }, credit: "Hoàng Giang" },
    { key: "pho-ca-phe-duong-tau-3", src: "/images/stories/pho-ca-phe-duong-tau-3.jpg", width: 800, height: 450, caption: { vi: "Du khách trải nghiệm cafe đường tàu Hà Nội", en: "Visitors enjoying a Hanoi Train Street café" }, credit: "Song Hoàng" },
  ],
  "lang-chu-tich-ho-chi-minh": [
    { key: "lang-chu-tich-ho-chi-minh-1", src: "/images/stories/lang-chu-tich-ho-chi-minh-1.jpg", width: 1600, height: 1065, caption: { vi: "Hoàng hôn ở Lăng Bác vào những ngày tháng 5 lịch sử", en: "Sunset over the Ho Chi Minh Mausoleum in the historic days of May" }, credit: "Minh Đức" },
    { key: "lang-chu-tich-ho-chi-minh-2", src: "/images/stories/lang-chu-tich-ho-chi-minh-2.jpg", width: 1000, height: 667, caption: { vi: "Lăng Bác", en: "Ho Chi Minh Mausoleum" }, credit: "Collected" },
  ],
  "hoang-thanh-thang-long": [
    { key: "hoang-thanh-thang-long-1", src: "/images/stories/hoang-thanh-thang-long-1.jpg", width: 663, height: 463, caption: { vi: "Hoàng Thành Thăng Long", en: "The Imperial Citadel of Thang Long" }, credit: "Fanpage Hoàng Thành Thăng Long - Imperial Citadel of Thang Long" },
    { key: "hoang-thanh-thang-long-2", src: "/images/stories/hoang-thanh-thang-long-2.jpg", width: 666, height: 443, caption: { vi: "Du khách xúng xính trong những tà áo dài rực rỡ sắc màu, thưởng ngoạn vẻ đẹp cổ kính của Hoàng thành Thăng Long", en: "Visitors dressed up in colourful áo dài take in the ancient beauty of the Imperial Citadel of Thang Long" }, credit: "Tiến Bách" },
    { key: "hoang-thanh-thang-long-3", src: "/images/stories/hoang-thanh-thang-long-3.jpg", width: 666, height: 394, caption: { vi: "Thềm Rồng điện Kính Thiên", en: "The Dragon Steps of Kính Thiên Palace" }, credit: "Xuân Chính" },
  ],
  "van-mieu-quoc-tu-giam": [
    { key: "van-mieu-quoc-tu-giam-1", src: "/images/stories/van-mieu-quoc-tu-giam-1.jpg", width: 1000, height: 640, caption: { vi: "Bia Tiến sĩ tại Văn Miếu - Quốc tử Giám", en: "Doctors' steles at the Temple of Literature" }, credit: "Collected" },
    { key: "van-mieu-quoc-tu-giam-2", src: "/images/stories/van-mieu-quoc-tu-giam-2.jpg", width: 1600, height: 1000, caption: { vi: "Văn Miếu - Quốc Tử Giám", en: "The Temple of Literature and Imperial Academy" }, credit: "Collected" },
    { key: "van-mieu-quoc-tu-giam-3", src: "/images/stories/van-mieu-quoc-tu-giam-3.jpg", width: 660, height: 440, caption: { vi: "Đoàn Trường Frederiksborg Gymnasium và đoàn Trường Nguyễn Tất Thành cùng chụp ảnh lưu niệm", en: "Groups from Frederiksborg Gymnasium and Nguyễn Tất Thành School pose for a souvenir photo" }, credit: "Trường THCS và THPT Nguyễn Tất Thành" },
  ],
  "chua-mot-cot": [
    { key: "chua-mot-cot-1", src: "/images/stories/chua-mot-cot-1.jpg", width: 908, height: 1135, caption: { vi: "13 bậc thang của ngôi chùa", en: "The pagoda's 13 steps" }, credit: "Collected" },
    { key: "chua-mot-cot-2", src: "/images/stories/chua-mot-cot-2.jpg", width: 1235, height: 768, caption: { vi: "Kiến trúc độc đáo của Chùa Một Cột", en: "The unique architecture of the One Pillar Pagoda" }, credit: "Tico travel" },
  ],
  "nha-tu-hoa-lo": [
    { key: "nha-tu-hoa-lo-1", src: "/images/stories/nha-tu-hoa-lo-1.jpg", width: 1200, height: 800, caption: { vi: "Nhà tù Hỏa Lò – điểm đến thú vị không thể bỏ lỡ", en: "Hoa Lo Prison, a fascinating sight not to be missed" }, credit: "Collected" },
    { key: "nha-tu-hoa-lo-2", src: "/images/stories/nha-tu-hoa-lo-2.jpg", width: 575, height: 431, caption: { vi: "Đại biểu và khách tham quan Nhà tù Hỏa Lò trong buổi Tọa đàm và giao lưu với nhân chứng lịch sử ở Nhà tù Hỏa Lò", en: "Guests and visitors at a talk and meeting with historical witnesses at Hoa Lo Prison" }, credit: "Khánh Huyền" },
  ],
  "ho-hoan-kiem-thap-rua": [
    { key: "ho-hoan-kiem-thap-rua-1", src: "/images/stories/ho-hoan-kiem-thap-rua-1.jpg", width: 900, height: 600, caption: { vi: "Bên trong trung đường đền Ngọc Sơn", en: "Inside the central hall of Ngọc Sơn Temple" }, credit: "Shutterstock" },
    { key: "ho-hoan-kiem-thap-rua-2", src: "/images/stories/ho-hoan-kiem-thap-rua-2.jpg", width: 900, height: 600, caption: { vi: "Bảng rồng và bảng hổ trước cổng đền Ngọc Sơn", en: "The dragon and tiger boards in front of the gate of Ngọc Sơn Temple" }, credit: "Shutterstock" },
    { key: "ho-hoan-kiem-thap-rua-3", src: "/images/stories/ho-hoan-kiem-thap-rua-3.jpg", width: 1600, height: 675, caption: { vi: "Hồ Gươm - nơi được mệnh danh là “trái tim” của Thủ đô Hà Nội", en: "Hoan Kiem Lake, known as the “heart” of Hanoi" }, credit: "Vinpearl" },
    { key: "ho-hoan-kiem-thap-rua-4", src: "/images/stories/ho-hoan-kiem-thap-rua-4.jpg", width: 800, height: 450, caption: { vi: "Hồ Gươm chiều tà", en: "Hoan Kiem Lake at sunset" }, credit: "Nguyễn Thị Thu Hà" },
    { key: "ho-hoan-kiem-thap-rua-5", src: "/images/stories/ho-hoan-kiem-thap-rua-5.jpg", width: 898, height: 600, caption: { vi: "Tháp Bút non Nghiên bên cạnh đền Ngọc Sơn", en: "The Pen Tower and the Inkstone beside Ngọc Sơn Temple" }, credit: "Shutterstock" },
    { key: "ho-hoan-kiem-thap-rua-6", src: "/images/stories/ho-hoan-kiem-thap-rua-6.jpg", width: 900, height: 599, caption: { vi: "Thư thái dạo quanh Hồ Gươm bằng xích lô", en: "A relaxing cyclo ride around Hoan Kiem Lake" }, credit: "Vinpearl" },
    { key: "ho-hoan-kiem-thap-rua-7", src: "/images/stories/ho-hoan-kiem-thap-rua-7.jpg", width: 898, height: 600, caption: { vi: "Đền Ngọc Sơn là biểu tượng văn hóa tâm linh nổi bật của Thủ đô Hà Nội", en: "Ngọc Sơn Temple, a leading cultural and spiritual symbol of Hanoi" }, credit: "Shutterstock" },
  ],
  "pho-co-ha-noi": [
    { key: "pho-co-ha-noi-1", src: "/images/stories/pho-co-ha-noi-1.jpg", width: 1200, height: 800, caption: { vi: "Phố cổ Hà Nội", en: "Hanoi's Old Quarter" }, credit: "VnEconomy" },
  ],
  "nha-hat-lon-ha-noi": [
    { key: "nha-hat-lon-ha-noi-1", src: "/images/stories/nha-hat-lon-ha-noi-1.jpg", width: 1000, height: 666, caption: { vi: "Nhà hát Lớn", en: "Hanoi Opera House" }, credit: "Collected" },
    { key: "nha-hat-lon-ha-noi-2", src: "/images/stories/nha-hat-lon-ha-noi-2.jpg", width: 640, height: 455, caption: { vi: "Màn trình chiếu ánh sáng mapping khai màn trong không gian Nhà Hát Lớn Hà Nội", en: "Opening projection-mapping light show at Hanoi Opera House" }, credit: "T.L" },
    { key: "nha-hat-lon-ha-noi-3", src: "/images/stories/nha-hat-lon-ha-noi-3.jpg", width: 1407, height: 959, caption: { vi: "Nhà hát Lớn Hà Nội - Điểm hẹn quen thuộc của du khách khi đến với Thủ đô", en: "Hanoi Opera House, a favourite meeting point for visitors to the capital" }, credit: "Collected" },
    { key: "nha-hat-lon-ha-noi-4", src: "/images/stories/nha-hat-lon-ha-noi-4.jpg", width: 1200, height: 800, caption: { vi: "Nhà hát Lớn Hà Nội kỷ niệm 110 năm với hoà nhạc \"Huyền thoại Opera\"", en: "Hanoi Opera House celebrates its 110th anniversary with the “Opera Legends” concert" }, credit: "VOV" },
    { key: "nha-hat-lon-ha-noi-5", src: "/images/stories/nha-hat-lon-ha-noi-5.jpg", width: 1600, height: 1066, caption: { vi: "Nhà hát Lớn Hà Nội được sử dụng là nơi biểu diễn các loại hình nghệ thuật cổ điển như Opera, nhạc thính phòng, kịch nói…", en: "Hanoi Opera House hosts classical performing arts such as opera, chamber music and spoken drama" }, credit: "Collected" },
    { key: "nha-hat-lon-ha-noi-6", src: "/images/stories/nha-hat-lon-ha-noi-6.jpg", width: 1600, height: 962, caption: { vi: "Nhà hát Lớn nằm tại Quảng trường Cách Mạng Tháng Tám", en: "Hanoi Opera House stands on August Revolution Square" }, credit: "Collected" },
    { key: "nha-hat-lon-ha-noi-7", src: "/images/stories/nha-hat-lon-ha-noi-7.jpg", width: 640, height: 427, caption: { vi: "Những bức tường ký ức sống lại, kể về lịch sử Nhà Hát Lớn qua hình ảnh các vở diễn danh tiếng, các loại hình nghệ thuật như kịch, opera, ballet... từng thăng hoa tại đây", en: "Memory walls come alive, telling the Opera House's story through famous productions and art forms such as drama, opera and ballet that have flourished here" }, credit: "Bộ VHTTDL" },
  ],
  "chua-tran-quoc": [
    { key: "chua-tran-quoc-1", src: "/images/stories/chua-tran-quoc-1.jpg", width: 800, height: 534, caption: { vi: "Bảo tháp lục độ đài sen tại chùa Trấn Quốc", en: "The Six Perfections Lotus Stupa at Tran Quoc Pagoda" }, credit: "Bảo Vy" },
    { key: "chua-tran-quoc-2", src: "/images/stories/chua-tran-quoc-2.jpg", width: 800, height: 529, caption: { vi: "Chùa Trấn Quốc", en: "Tran Quoc Pagoda" }, credit: "Bảo Vy" },
    { key: "chua-tran-quoc-3", src: "/images/stories/chua-tran-quoc-3.jpg", width: 800, height: 543, caption: { vi: "Trong chùa Trấn Quốc", en: "Inside Tran Quoc Pagoda" }, credit: "Bảo Vy" },
  ],
  "bao-tang-lich-su-quan-su": [
    { key: "bao-tang-lich-su-quan-su-1", src: "/images/stories/bao-tang-lich-su-quan-su-1.jpg", width: 800, height: 533, caption: { vi: "Bảo tàng được thiết kế theo phong cách hiện đại với 4 tầng nổi và một tầng bán âm", en: "The museum has a modern design with four storeys above ground and a semi-basement" }, credit: "ZNews" },
    { key: "bao-tang-lich-su-quan-su-2", src: "/images/stories/bao-tang-lich-su-quan-su-2.jpg", width: 800, height: 533, caption: { vi: "Hiện vật được trưng bày kèm chú thích và hình ảnh cụ thể giúp khách tham quan có thể hiểu được nội dung của từng thời kỳ", en: "Exhibits are shown with captions and images that help visitors understand each period" }, credit: "kinhtevadulich" },
    { key: "bao-tang-lich-su-quan-su-3", src: "/images/stories/bao-tang-lich-su-quan-su-3.jpg", width: 800, height: 533, caption: { vi: "Toàn cảnh Bảo tàng Lịch sử Quân sự Việt Nam mới", en: "A panoramic view of the new Vietnam Military History Museum" }, credit: "kinhtevadulich" },
  ],
  "bao-tang-dan-toc-hoc": [
    { key: "bao-tang-dan-toc-hoc-1", src: "/images/stories/bao-tang-dan-toc-hoc-1.jpg", width: 680, height: 510, caption: { vi: "Bảo tàng Dân tộc học Việt Nam – điểm hội tụ tinh hoa văn hóa 54 dân tộc anh em", en: "The Vietnam Museum of Ethnology, a meeting point for the cultures of Vietnam's 54 ethnic groups" }, credit: "IVIVU" },
    { key: "bao-tang-dan-toc-hoc-2", src: "/images/stories/bao-tang-dan-toc-hoc-2.jpg", width: 567, height: 378, caption: { vi: "Bức tường miêu tả sơ lược về 54 dân tộc Việt Nam tại Toà Trống Đồng", en: "A wall giving a brief overview of Vietnam's 54 ethnic groups in the Bronze Drum building" }, credit: "Mai Khôi" },
    { key: "bao-tang-dan-toc-hoc-3", src: "/images/stories/bao-tang-dan-toc-hoc-3.jpg", width: 567, height: 378, caption: { vi: "Đông đảo du khách quốc tế tham quan tại Bảo tàng", en: "Crowds of international visitors touring the museum" }, credit: "Mai Khôi" },
  ],
  "chua-quan-su": [
    { key: "chua-quan-su-1", src: "/images/stories/chua-quan-su-1.jpg", width: 1600, height: 1066, caption: { vi: "Các hoạt động Phật Giáo tại chùa Quán Sứ", en: "Buddhist activities at Quán Sứ Pagoda" }, credit: "Green Future" },
    { key: "chua-quan-su-2", src: "/images/stories/chua-quan-su-2.jpg", width: 1600, height: 1067, caption: { vi: "Phật tử tìm đến chùa Quán Sứ để cầu an và tìm hiểu về lịch sử", en: "Buddhists come to Quán Sứ Pagoda to pray for peace and learn about its history" }, credit: "Green Future" },
    { key: "chua-quan-su-3", src: "/images/stories/chua-quan-su-3.jpg", width: 1600, height: 1066, caption: { vi: "Ở bậc cao nhất, chùa thờ ba vị Tam Thế Phật", en: "On the highest tier, the pagoda honours the Buddhas of the Three Times" }, credit: "Green Future" },
  ],
  "bao-tang-my-thuat": [
    { key: "bao-tang-my-thuat-1", src: "/images/stories/bao-tang-my-thuat-1.jpg", width: 1060, height: 570, caption: { vi: "Kiến trúc tuyệt đẹp của Bảo tàng Mỹ thuật Việt Nam Hà Nội", en: "The striking architecture of the Vietnam Fine Arts Museum in Hanoi" }, credit: "Collected" },
    { key: "bao-tang-my-thuat-2", src: "/images/stories/bao-tang-my-thuat-2.jpg", width: 800, height: 350, caption: { vi: "Địa chỉ Bảo tàng Mỹ thuật Việt Nam ở số 66 Nguyễn Thái Học, Q. Ba Đình, TP. Hà Nội", en: "The Vietnam Fine Arts Museum at 66 Nguyễn Thái Học Street, Ba Đình District, Hanoi" }, credit: "Collected" },
  ],
  "bao-tang-thien-nhien": [
    { key: "bao-tang-thien-nhien-1", src: "/images/stories/bao-tang-thien-nhien-1.jpg", width: 900, height: 514, caption: { vi: "Lối vào Bảo tàng Thiên nhiên Việt Nam với mô hình khủng long phía trước", en: "The entrance of the Vietnam National Museum of Nature, with a dinosaur model out front" }, credit: "Collected" },
    { key: "bao-tang-thien-nhien-2", src: "/images/stories/bao-tang-thien-nhien-2.jpg", width: 800, height: 544, caption: { vi: "Mô hình khủng long bạo chúa kích thước thật đón khách ở lối vào bảo tàng", en: "A life-size Tyrannosaurus model greets visitors at the museum entrance" }, credit: "Collected" },
    { key: "bao-tang-thien-nhien-3", src: "/images/stories/bao-tang-thien-nhien-3.jpg", width: 800, height: 532, caption: { vi: "Hóa thạch và quá trình tiến hóa của loài người trong phòng trưng bày tiến hóa", en: "Fossils and human evolution displays in the evolution gallery" }, credit: "Collected" },
  ],
  "le-hoi-chua-huong": [
    { key: "le-hoi-chua-huong-1", src: "/images/stories/le-hoi-chua-huong-1.jpg", width: 1600, height: 1067, caption: { vi: "Chương trình văn nghệ tại lễ khai hội chùa Hương", en: "Performances at the opening ceremony of the Perfume Pagoda Festival" }, credit: "Trần Việt/TTXVN" },
    { key: "le-hoi-chua-huong-2", src: "/images/stories/le-hoi-chua-huong-2.jpg", width: 900, height: 600, caption: { vi: "Du khách tham quan di tích quốc gia đặc biệt quần thể Hương Sơn", en: "Visitors at the Hương Sơn complex, a special national relic" }, credit: "Báo điện tử Chính phủ" },
    { key: "le-hoi-chua-huong-3", src: "/images/stories/le-hoi-chua-huong-3.jpg", width: 1576, height: 1023, caption: { vi: "Du khách trảy hội chùa Hương", en: "Pilgrims on their way to the Perfume Pagoda Festival" }, credit: "Trần Việt/TTXVN" },
    { key: "le-hoi-chua-huong-4", src: "/images/stories/le-hoi-chua-huong-4.jpg", width: 1550, height: 998, caption: { vi: "Du khách đi lễ cầu may đầu năm tại lễ hội chùa Hương", en: "Visitors praying for luck at the start of the year at the Perfume Pagoda Festival" }, credit: "Trần Việt/TTXVN" },
    { key: "le-hoi-chua-huong-5", src: "/images/stories/le-hoi-chua-huong-5.jpg", width: 800, height: 533, caption: { vi: "Kiến trúc Chùa Hương vẫn lưu giữ được nét cổ kính vốn có", en: "The Perfume Pagoda's architecture keeps its age-old character" }, credit: "Collected" },
    { key: "le-hoi-chua-huong-6", src: "/images/stories/le-hoi-chua-huong-6.jpg", width: 1020, height: 680, caption: { vi: "Lễ hội chùa Hương 2026 điểm đến văn hóa truyền thống Việt", en: "The 2026 Perfume Pagoda Festival, a destination for traditional Vietnamese culture" }, credit: "Collected" },
    { key: "le-hoi-chua-huong-7", src: "/images/stories/le-hoi-chua-huong-7.jpg", width: 576, height: 321, caption: { vi: "Ngay từ những ngày đầu, lượng du khách đến với lễ hội chùa Hương đã rất đông", en: "Large crowds at the Perfume Pagoda Festival from its very first days" }, credit: "Báo Cựu chiến binh Thủ đô" },
    { key: "le-hoi-chua-huong-8", src: "/images/stories/le-hoi-chua-huong-8.jpg", width: 1000, height: 986, caption: { vi: "Thuyền đò sẵn sàng phục vụ khách tham quan Chùa Hương", en: "Boats waiting to carry visitors to the Perfume Pagoda" }, credit: "Báo Lao động" },
    { key: "le-hoi-chua-huong-9", src: "/images/stories/le-hoi-chua-huong-9.jpg", width: 665, height: 443, caption: { vi: "Động Hương Tích với những truyền thuyết thần kỳ về giọt nước thánh", en: "Hương Tích Cave, with its legends of miraculous holy water drops" }, credit: "Collected" },
  ],
  "le-hoi-go-dong-da": [
    { key: "le-hoi-go-dong-da-1", src: "/images/stories/le-hoi-go-dong-da-1.jpg", width: 1600, height: 900, caption: { vi: "Khai hội Gò Đống Đa 2026", en: "Opening of the 2026 Gò Đống Đa festival" }, credit: "VTV" },
    { key: "le-hoi-go-dong-da-2", src: "/images/stories/le-hoi-go-dong-da-2.jpg", width: 1600, height: 1200, caption: { vi: "Lễ dâng hoa tại tượng đài Hoàng Đế Quang Trung - Nguyễn Huệ", en: "Flower offering at the statue of Emperor Quang Trung – Nguyễn Huệ" }, credit: "Báo Sức khỏe & Đời sống" },
    { key: "le-hoi-go-dong-da-3", src: "/images/stories/le-hoi-go-dong-da-3.jpg", width: 1600, height: 1200, caption: { vi: "Lễ rước kiệu diễn ra trong không khí tưng bừng. Đoàn rước di chuyển chậm rãi để người dân có thể nhìn thấy được sự tỉ mỉ và hoành tráng của lễ hội. Đi sau cùng đoàn rước là hình tượng Rồng lửa", en: "The palanquin procession moves slowly in a festive atmosphere so people can take in the festival's detail and grandeur, with a fire dragon at the rear" }, credit: "Báo Sức khỏe & Đời sống" },
    { key: "le-hoi-go-dong-da-4", src: "/images/stories/le-hoi-go-dong-da-4.jpg", width: 800, height: 450, caption: { vi: "Lễ tế, rước kiệu vua Quang Trung và hoàng hậu Ngọc Hân", en: "Ritual offerings and the palanquin procession of Emperor Quang Trung and Empress Ngọc Hân" }, credit: "Collected" },
    { key: "le-hoi-go-dong-da-5", src: "/images/stories/le-hoi-go-dong-da-5.jpg", width: 900, height: 599, caption: { vi: "Người dân nô nức tham dự hòa mình vào không khí lễ hội", en: "Crowds eagerly joining in the festival atmosphere" }, credit: "Collected" },
    { key: "le-hoi-go-dong-da-6", src: "/images/stories/le-hoi-go-dong-da-6.jpg", width: 730, height: 416, caption: { vi: "Lễ hội Gò Đống Đa", en: "Gò Đống Đa festival" }, credit: "Collected" },
  ],
  "le-hoi-co-loa": [
    { key: "le-hoi-co-loa-1", src: "/images/stories/le-hoi-co-loa-1.jpg", width: 1024, height: 576, caption: { vi: "Bức tượng Thần Cao Lỗ, người chế tạo nỏ thần tại khu vực Điếm Xóm Chùa nằm trong khuôn viên di tích Cổ Loa", en: "Statue of the deity Cao Lỗ, maker of the magic crossbow, at Điếm Xóm Chùa within the Cổ Loa relic site" }, credit: "Thái Sơn" },
    { key: "le-hoi-co-loa-2", src: "/images/stories/le-hoi-co-loa-2.jpg", width: 800, height: 512, caption: { vi: "Các võ sĩ tham gia Giải đấu vật tại lễ hội Cổ Loa", en: "Wrestlers competing in the wrestling tournament at the Cổ Loa festival" }, credit: "Báo Quân đội Nhân dân" },
    { key: "le-hoi-co-loa-3", src: "/images/stories/le-hoi-co-loa-3.jpg", width: 1024, height: 576, caption: { vi: "Lãnh đạo xã Đông Anh khai mạc Hội thi bắn nỏ", en: "Đông Anh commune leaders open the crossbow shooting contest" }, credit: "Thái Sơn" },
    { key: "le-hoi-co-loa-4", src: "/images/stories/le-hoi-co-loa-4.jpg", width: 1600, height: 894, caption: { vi: "Người dân đến xem Giải Cờ người được tổ chức hàng năm tại lễ hội Cổ Loa", en: "Locals watching the annual human chess tournament at the Cổ Loa festival" }, credit: "Thành ủy Hà Nội" },
    { key: "le-hoi-co-loa-5", src: "/images/stories/le-hoi-co-loa-5.jpg", width: 638, height: 480, caption: { vi: "Sẵn sàng cho Lễ hội Cổ Loa - Xuân Bính Ngọ 2026", en: "Ready for the Cổ Loa festival, spring of the Year of the Horse 2026" }, credit: "Báo Lao động Thủ đô" },
    { key: "le-hoi-co-loa-6", src: "/images/stories/le-hoi-co-loa-6.jpg", width: 1000, height: 700, caption: { vi: "Trò chơi dân gian thu hút đông đảo người dân đến xem tại lễ hội Cổ Loa", en: "Folk games draw large crowds of spectators at the Cổ Loa festival" }, credit: "Collected" },
    { key: "le-hoi-co-loa-7", src: "/images/stories/le-hoi-co-loa-7.jpg", width: 1200, height: 900, caption: { vi: "Đông đảo người dân đội mưa dự lễ khai hội Cổ Loa đầu năm 2026", en: "Crowds brave the rain for the opening ceremony of the Cổ Loa festival in early 2026" }, credit: "VOV" },
  ],
  "le-hoi-den-hai-ba-trung": [
    { key: "le-hoi-den-hai-ba-trung-1", src: "/images/stories/le-hoi-den-hai-ba-trung-1.jpg", width: 1430, height: 953, caption: { vi: "Bộ môn Cờ người được tổ chức, thu hút đông đảo người dân ở mọi lứa tuổi tham gia", en: "Human chess draws crowds of local people of all ages" }, credit: "Trang thông tin điện tử xã Mê Linh" },
    { key: "le-hoi-den-hai-ba-trung-2", src: "/images/stories/le-hoi-den-hai-ba-trung-2.jpg", width: 1430, height: 953, caption: { vi: "Bộ môn Vật dân tộc được đông đảo nhân dân đón xem", en: "Traditional wrestling draws large crowds of spectators" }, credit: "Trang thông tin điện tử xã Mê Linh" },
    { key: "le-hoi-den-hai-ba-trung-3", src: "/images/stories/le-hoi-den-hai-ba-trung-3.jpg", width: 1600, height: 1058, caption: { vi: "Khai hội đền Hai Bà Trưng với chương trình nghệ thuật \"Âm vang Mê Linh\"", en: "The temple festival opens with the art programme “Âm vang Mê Linh” (Echoes of Mê Linh)" }, credit: "Báo Dân sinh Dân trí" },
    { key: "le-hoi-den-hai-ba-trung-4", src: "/images/stories/le-hoi-den-hai-ba-trung-4.jpg", width: 1000, height: 696, caption: { vi: "Lễ rước vua Bà nhằm tưởng nhớ công lao to lớn của Hai Bà, giúp thế hệ trẻ hiểu hơn về lịch sử anh hùng của dân tộc ta", en: "The procession of the Queens honours the Trưng Sisters' great deeds and helps young people understand the nation's heroic history" }, credit: "Thành Nguyễn" },
    { key: "le-hoi-den-hai-ba-trung-5", src: "/images/stories/le-hoi-den-hai-ba-trung-5.jpg", width: 1000, height: 659, caption: { vi: "Từ trong sân đền, kiệu Bà Trưng Trắc đi trước, nhưng khi ra khỏi cổng đền, kiệu Bà Trưng Trắc dừng lại bên phải đường để kiệu Bà Trưng Nhị đi trước (với ý nghĩa\" Nội gia tỷ muội, ngoại quốc quân thần)", en: "Trưng Trắc's palanquin leads in the temple courtyard but stops to the right outside the gate to let Trưng Nhị's go first – “sisters at home, sovereign and subject in the realm”" }, credit: "Thành Nguyễn" },
    { key: "le-hoi-den-hai-ba-trung-6", src: "/images/stories/le-hoi-den-hai-ba-trung-6.jpg", width: 1430, height: 953, caption: { vi: "Vận động viên của các thôn đang thi đấu tranh giải ở bộ môn Bóng chuyền hơi", en: "Village teams compete in the air volleyball tournament" }, credit: "Trang thông tin điện tử xã Mê Linh" },
    { key: "le-hoi-den-hai-ba-trung-7", src: "/images/stories/le-hoi-den-hai-ba-trung-7.jpg", width: 1600, height: 1065, caption: { vi: "Đông đảo du khách thập phương tới dự lễ và xem chương trình nghệ thuật khai hội Đền Hai Bà Trưng", en: "Crowds of visitors from near and far attend the ceremony and the festival's opening performance at Hai Bà Trưng Temple" }, credit: "Báo Dân sinh Dân trí" },
    { key: "le-hoi-den-hai-ba-trung-8", src: "/images/stories/le-hoi-den-hai-ba-trung-8.jpg", width: 1023, height: 789, caption: { vi: "Đội nữ binh hộ giá cùng voi trắng, ngựa hồng, ngựa bạch… tạo nên bức tranh lễ hội linh thiêng", en: "Female guards of honour with white elephants, red horses and white horses create a sacred festival scene" }, credit: "Trang thông tin điện tử xã Mê Linh" },
  ],
  "hoi-giong": [
    { key: "hoi-giong-1", src: "/images/stories/hoi-giong-1.jpg", width: 1000, height: 676, caption: { vi: "Hoạt động kéo co với sự tham gia, cổ vũ của nhiều người dân địa phương và khách du lịch", en: "Tug of war, with many local people and tourists taking part and cheering" }, credit: "Doanhnghieptiepthi.vn" },
    { key: "hoi-giong-2", src: "/images/stories/hoi-giong-2.jpg", width: 1200, height: 801, caption: { vi: "Hội Gióng đền Phù Đổng được UNESCO ghi danh là Di sản văn hóa phi vật thể đại diện của nhân loại ngày 16/11/2010", en: "The Gióng Festival at Phù Đổng Temple, officially inscribed by UNESCO as a Representative Intangible Cultural Heritage of Humanity on 16 November 2010" }, credit: "VOV" },
    { key: "hoi-giong-3", src: "/images/stories/hoi-giong-3.jpg", width: 1000, height: 561, caption: { vi: "Lễ rước “nữ tướng” diễn ra vào ngày hội chính thức", en: "The procession of the “female generals” on the main festival day" }, credit: "Nld.com.vn" },
    { key: "hoi-giong-4", src: "/images/stories/hoi-giong-4.jpg", width: 900, height: 589, caption: { vi: "Quang cảnh Lễ hội Gióng tại đền Phù Đổng (xã Phù Đổng)", en: "The Gióng Festival at Phù Đổng Temple (Phù Đổng commune)" }, credit: "Báo Hà Nội mới" },
    { key: "hoi-giong-5", src: "/images/stories/hoi-giong-5.jpg", width: 1000, height: 556, caption: { vi: "Trai làng lăn xả thi đấu cầu húc tại lễ hội Gióng Sóc Sơn", en: "Village young men throw themselves into the cầu húc ball contest at the Sóc Sơn Gióng Festival" }, credit: "Kinhtedothi.vn" },
    { key: "hoi-giong-6", src: "/images/stories/hoi-giong-6.jpg", width: 1600, height: 1067, caption: { vi: "Đặc sắc chương trình nghệ thuật khai mạc Hội Gióng Đền Phù Đổng 2026", en: "Highlights of the opening art programme of the 2026 Gióng Festival at Phù Đổng Temple" }, credit: "Xã Phù Đổng" },
  ],
};

/** Every photo of each story: the folder's, then the festival photos from Wikimedia Commons. */
export const storyPhotos: Record<string, StoryPhoto[]> = { ...folderPhotos, ...festivalStoryPhotos };

/** Story names for the credits page. */
const folderNames: Record<string, { vi: string; en: string }> = {
  "pho-ca-phe-duong-tau": { vi: "Phố cà phê đường tàu", en: "Hanoi Train Street" },
  "lang-chu-tich-ho-chi-minh": { vi: "Lăng Chủ tịch Hồ Chí Minh", en: "Ho Chi Minh Mausoleum" },
  "hoang-thanh-thang-long": { vi: "Hoàng thành Thăng Long", en: "Imperial Citadel of Thang Long" },
  "van-mieu-quoc-tu-giam": { vi: "Văn Miếu – Quốc Tử Giám", en: "Temple of Literature and the Imperial Academy" },
  "chua-mot-cot": { vi: "Chùa Một Cột", en: "One Pillar Pagoda" },
  "nha-tu-hoa-lo": { vi: "Nhà tù Hỏa Lò", en: "Hoa Lo Prison" },
  "ho-hoan-kiem-thap-rua": { vi: "Hồ Gươm & Đền Ngọc Sơn", en: "Hoan Kiem Lake and Ngọc Sơn Temple" },
  "pho-co-ha-noi": { vi: "Phố cổ Hà Nội", en: "Hanoi's Old Quarter" },
  "nha-hat-lon-ha-noi": { vi: "Nhà hát Lớn Hà Nội", en: "Hanoi Opera House" },
  "chua-tran-quoc": { vi: "Chùa Trấn Quốc", en: "Tran Quoc Pagoda" },
  "bao-tang-lich-su-quan-su": { vi: "Bảo tàng Lịch sử Quân sự Việt Nam", en: "Vietnam Military History Museum" },
  "bao-tang-dan-toc-hoc": { vi: "Bảo tàng Dân tộc học Việt Nam", en: "Vietnam Museum of Ethnology" },
  "chua-quan-su": { vi: "Chùa Quán Sứ", en: "Quán Sứ Pagoda" },
  "bao-tang-my-thuat": { vi: "Bảo tàng Mỹ thuật Việt Nam", en: "Vietnam Fine Arts Museum" },
  "bao-tang-thien-nhien": { vi: "Bảo tàng Thiên nhiên Việt Nam", en: "Vietnam National Museum of Nature" },
  "le-hoi-chua-huong": { vi: "Chùa Hương", en: "Perfume Pagoda" },
  "le-hoi-go-dong-da": { vi: "Lễ hội Gò Đống Đa", en: "Gò Đống Đa Festival" },
  "le-hoi-co-loa": { vi: "Lễ hội Cổ Loa", en: "Cổ Loa Festival" },
  "le-hoi-den-hai-ba-trung": { vi: "Lễ hội đền Hai Bà Trưng", en: "Hai Bà Trưng Temple Festival" },
  "hoi-giong": { vi: "Hội Gióng", en: "Gióng Festival" },
};

export const storyNames: Record<string, { vi: string; en: string }> = { ...folderNames, ...festivalStoryNames };

/** The story photos as images, so a story's cover is found by its image key like any other photo. */
export const storyImages: Record<string, HanoiImage> = Object.fromEntries(
  Object.values(storyPhotos).flat().map((photo) => [photo.key, {
    key: photo.key, src: photo.src, alt: photo.caption.en, title: photo.caption.vi,
    author: photo.credit, license: photo.license ?? "", sourceUrl: photo.sourceUrl ?? "",
  }]),
);

/** Wikimedia photos on the home strip that show a landmark with a story. */
export const storyForImage: Record<string, string> = {
  hero: "ho-hoan-kiem-thap-rua", "old-quarter": "pho-co-ha-noi", history: "van-mieu-quoc-tu-giam",
  one_pillar_pagoda: "chua-mot-cot", art: "nha-hat-lon-ha-noi", park: "chua-tran-quoc",
  imperial_citadel: "hoang-thanh-thang-long", ho_chi_minh_mausoleum: "lang-chu-tich-ho-chi-minh",
  museum: "bao-tang-dan-toc-hoc",
};
