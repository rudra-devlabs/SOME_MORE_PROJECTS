dec = int(input("Enter a decimal number: "))
string = ""
while (dec > 0):
    rem = dec%2
    string += str(rem)
    dec //= 2
print(string)
    
    