"""Build a layout-preserving Word template from the repository's official PDF.
Run with the bundled document runtime. Source PDF pages are immutable background
images; the application adds editable answer text boxes in measured blank areas.
"""
import argparse
import hashlib
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

parser=argparse.ArgumentParser()
parser.add_argument('--pdftoppm',required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
source=root/'public/forms/refugee-application-2019.pdf'
target=root/'public/forms/refugee-application-2019-word.docx'
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
with tempfile.TemporaryDirectory(prefix='dari-word-pages-') as tmp:
 subprocess.run([args.pdftoppm,'-r','144','-jpeg','-jpegopt','quality=92',str(source),str(Path(tmp)/'page')],check=True)
 pages=sorted(Path(tmp).glob('page-*.jpg'))
 if len(pages)!=22:raise ValueError('Expected the supplied 22-page form')
 parts=[];rels=[]
 for page in range(1,23):
  parts.append(f'''<w:p><w:pPr>{'<w:pageBreakBefore/>' if page>1 else ''}<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:pict><v:shape id="form-page-{page}" type="#_x0000_t75" style="position:absolute;margin-left:0pt;margin-top:0pt;width:595.28pt;height:841.89pt;z-index:-251654144;mso-position-horizontal-relative:page;mso-position-vertical-relative:page" stroked="f"><v:imagedata r:id="rId{page}"/><w10:wrap type="none"/></v:shape></w:pict></w:r><!--DARI_PAGE_{page}--></w:p>''')
  rels.append(f'<Relationship Id="rId{page}" Type="{R}/image" Target="media/page-{page}.jpg"/>')
 document=f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="{W}" xmlns:r="{R}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w10="urn:schemas-microsoft-com:office:word"><w:body>{''.join(parts)}<!--DARI_APPENDIX--><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="0" w:bottom="0" w:left="0" w:right="0" w:header="0" w:footer="0"/></w:sectPr></w:body></w:document>'''
 content=f'''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'''
 with ZipFile(target,'w',ZIP_DEFLATED) as z:
  z.writestr('[Content_Types].xml',content)
  z.writestr('_rels/.rels',f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{R}/officeDocument" Target="word/document.xml"/></Relationships>')
  z.writestr('word/document.xml',document)
  z.writestr('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(rels)+'</Relationships>')
  for page,path in enumerate(pages,1):z.write(path,f'word/media/page-{page}.jpg')
print(target)
print('Source PDF SHA256',hashlib.sha256(source.read_bytes()).hexdigest())
